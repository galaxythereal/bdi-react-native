import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Theme from '../../constants/theme';
import { useTheme } from '../context/ThemeContext';

export interface QuizQuestion {
    id: string;
    question: string;
    type: 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_answer';
    options?: (string | { id: string; text: string; correct?: boolean })[];
    correct_answer: string | number | number[]; // Can be array for multiple_select
    explanation?: string;
    points?: number;
}

export interface QuizData {
    id: string;
    title: string;
    description?: string;
    time_limit?: number; // in minutes
    passing_score?: number; // percentage
    questions: QuizQuestion[];
    allow_retry?: boolean;
}

export interface QuizAnswer {
    questionId: string;
    answer: string | number | number[] | null; // Can be array for multiple_select
}

export interface QuizResult {
    score: number;
    totalPoints: number;
    percentage: number;
    passed: boolean;
    answers: {
        questionId: string;
        correct: boolean;
        userAnswer: string | number | number[] | null;
        correctAnswer: string | number | number[];
    }[];
}

interface QuizComponentProps {
    quiz: QuizData;
    onComplete: (result: QuizResult) => void;
    onCancel?: () => void;
    showResults?: boolean;
    previousResult?: QuizResult;
}

type QuizState = 'intro' | 'quiz' | 'results';

// Helper function to extract text from option (handles both string and object format)
const getOptionText = (option: string | { id: string; text: string; correct?: boolean } | undefined): string => {
    if (!option) return 'No answer';
    if (typeof option === 'string') return option;
    return option.text || 'No answer';
};

export const QuizComponent: React.FC<QuizComponentProps> = ({
    quiz,
    onComplete,
    onCancel,
    showResults = true,
    previousResult,
}) => {
    const { colors, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);

    // Validate quiz data
    const hasValidQuestions = quiz?.questions && Array.isArray(quiz.questions) && quiz.questions.length > 0;

    const [state, setState] = useState<QuizState>(previousResult ? 'results' : 'intro');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<QuizAnswer[]>([]);
    const [result, setResult] = useState<QuizResult | null>(previousResult || null);
    const [timeRemaining, setTimeRemaining] = useState<number | null>(
        quiz?.time_limit ? quiz.time_limit * 60 : null
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showExplanation, setShowExplanation] = useState<string | null>(null);

    // NEW: Track which questions have been checked/submitted
    const [checkedQuestions, setCheckedQuestions] = useState<Set<number>>(new Set());
    const [questionResults, setQuestionResults] = useState<Map<number, boolean>>(new Map());

    const progressAnim = React.useRef(new Animated.Value(0)).current;
    const questionAnim = React.useRef(new Animated.Value(0)).current;

    // Safe access to questions
    const questions = quiz?.questions || [];
    const currentQuestion = questions[currentQuestionIndex];
    const totalQuestions = questions.length;

    // Early return if no valid questions (after hooks)
    // Note: We render an error state at the end instead of returning null here
    // because hooks must be called unconditionally

    // Timer effect
    useEffect(() => {
        if (state !== 'quiz' || timeRemaining === null) return;

        const timer = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev === null || prev <= 1) {
                    clearInterval(timer);
                    // Time's up - auto submit
                    submitQuiz();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [state]);

    // Progress animation
    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: (currentQuestionIndex + 1) / totalQuestions,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [currentQuestionIndex, totalQuestions]);

    // Question transition animation
    const animateQuestion = useCallback(() => {
        questionAnim.setValue(0);
        Animated.spring(questionAnim, {
            toValue: 1,
            tension: 50,
            friction: 8,
            useNativeDriver: true,
        }).start();
    }, [questionAnim]);

    useEffect(() => {
        if (state === 'quiz') {
            animateQuestion();
        }
    }, [currentQuestionIndex, state, animateQuestion]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startQuiz = () => {
        if (!hasValidQuestions) return;
        // Initialize answers - for multiple_select, start with empty array
        setAnswers(questions.map((q) => ({
            questionId: q.id,
            answer: q.type === 'multiple_select' ? [] : null
        })));
        setCurrentQuestionIndex(0);
        setResult(null);
        setCheckedQuestions(new Set());
        setQuestionResults(new Map());
        setState('quiz');
        if (quiz?.time_limit) {
            setTimeRemaining(quiz.time_limit * 60);
        }
    };

    // Handle answer selection - supports both single and multiple select
    const selectAnswer = (answer: string | number) => {
        if (!currentQuestion) return;
        // Don't allow changing answer if already checked
        if (checkedQuestions.has(currentQuestionIndex)) return;

        const newAnswers = [...answers];

        // Handle multiple_select differently - toggle selections
        if (currentQuestion.type === 'multiple_select') {
            const currentSelections = (newAnswers[currentQuestionIndex]?.answer as number[]) || [];
            const answerIndex = answer as number;

            // Toggle the selection
            let newSelections: number[];
            if (currentSelections.includes(answerIndex)) {
                // Remove from selections
                newSelections = currentSelections.filter(s => s !== answerIndex);
            } else {
                // Add to selections
                newSelections = [...currentSelections, answerIndex].sort((a, b) => a - b);
            }

            newAnswers[currentQuestionIndex] = {
                questionId: currentQuestion.id,
                answer: newSelections,
            };
        } else {
            // Single selection for other question types
            newAnswers[currentQuestionIndex] = {
                questionId: currentQuestion.id,
                answer,
            };
        }
        setAnswers(newAnswers);
    };

    // NEW: Check/Submit current answer and show feedback
    const checkCurrentAnswer = () => {
        if (!currentQuestion || !isCurrentAnswered) return;
        if (checkedQuestions.has(currentQuestionIndex)) return;

        const userAnswer = answers[currentQuestionIndex]?.answer;
        let isCorrect = false;

        if (currentQuestion.type === 'multiple_select') {
            // For multiple_select, check if arrays match (both should be sorted)
            const userSelections = (userAnswer as number[]) || [];
            const correctAnswers = Array.isArray(currentQuestion.correct_answer)
                ? (currentQuestion.correct_answer as number[]).sort((a, b) => a - b)
                : [currentQuestion.correct_answer as number];

            // Check if arrays are equal
            isCorrect = userSelections.length === correctAnswers.length &&
                userSelections.every((val, idx) => val === correctAnswers[idx]);
        } else {
            isCorrect = String(userAnswer) === String(currentQuestion.correct_answer);
        }

        // Mark this question as checked
        setCheckedQuestions(prev => new Set(prev).add(currentQuestionIndex));
        setQuestionResults(prev => new Map(prev).set(currentQuestionIndex, isCorrect));
    };

    // Check if current question has been checked
    const isCurrentChecked = checkedQuestions.has(currentQuestionIndex);
    const currentQuestionResult = questionResults.get(currentQuestionIndex);

    const goToNextQuestion = () => {
        if (currentQuestionIndex < totalQuestions - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
    };

    const goToPreviousQuestion = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(currentQuestionIndex - 1);
        }
    };

    const goToQuestion = (index: number) => {
        setCurrentQuestionIndex(index);
    };

    // Stable submit function for timer
    const submitQuiz = useCallback(() => {
        if (!hasValidQuestions || isSubmitting) return;
        setIsSubmitting(true);

        // Calculate results
        let totalPoints = 0;
        let earnedPoints = 0;
        const answerResults: QuizResult['answers'] = [];

        questions.forEach((question, index) => {
            const points = question.points || 1;
            totalPoints += points;
            const userAnswer = answers[index]?.answer;

            let isCorrect = false;

            if (question.type === 'multiple_select') {
                // For multiple_select, check if arrays match
                const userSelections = (userAnswer as number[]) || [];
                const correctAnswers = Array.isArray(question.correct_answer)
                    ? (question.correct_answer as number[]).sort((a, b) => a - b)
                    : [question.correct_answer as number];

                isCorrect = userSelections.length === correctAnswers.length &&
                    userSelections.every((val, idx) => val === correctAnswers[idx]);
            } else {
                isCorrect = String(userAnswer) === String(question.correct_answer);
            }

            if (isCorrect) {
                earnedPoints += points;
            }

            answerResults.push({
                questionId: question.id,
                correct: isCorrect,
                userAnswer,
                correctAnswer: question.correct_answer,
            });
        });

        const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
        const passed = percentage >= (quiz?.passing_score || 70);

        const quizResult: QuizResult = {
            score: earnedPoints,
            totalPoints,
            percentage,
            passed,
            answers: answerResults,
        };

        setResult(quizResult);
        setIsSubmitting(false);
        setState('results');
        onComplete(quizResult);
    }, [hasValidQuestions, isSubmitting, questions, answers, quiz?.passing_score, onComplete]);

    const handleSubmit = async () => {
        submitQuiz();
    };

    // Check if current question is answered
    const currentAnswer = answers[currentQuestionIndex]?.answer;
    // For multiple_select, check if at least one option is selected
    const isCurrentAnswered = currentQuestion?.type === 'multiple_select'
        ? Array.isArray(currentAnswer) && currentAnswer.length > 0
        : currentAnswer !== null && currentAnswer !== undefined;

    // Count answered questions
    const answeredCount = answers.filter((a, idx) => {
        const q = questions[idx];
        if (q?.type === 'multiple_select') {
            return Array.isArray(a.answer) && a.answer.length > 0;
        }
        return a.answer !== null && a.answer !== undefined;
    }).length;

    const retakeQuiz = () => {
        if (quiz?.allow_retry !== false) {
            startQuiz();
        }
    };

    // Error state - no valid questions
    if (!hasValidQuestions) {
        return (
            <View style={styles.container}>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
                    <Text style={styles.errorTitle}>Quiz Not Available</Text>
                    <Text style={styles.errorText}>
                        This quiz doesn't have any questions yet. Please check back later.
                    </Text>
                    {onCancel && (
                        <TouchableOpacity style={styles.errorBackButton} onPress={onCancel}>
                            <Text style={styles.errorBackButtonText}>Go Back</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    }

    // Intro Screen
    if (state === 'intro') {
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
                <View style={styles.introCard}>
                    <View style={styles.quizIconContainer}>
                        <Ionicons name="clipboard" size={48} color={colors.primary} />
                    </View>

                    <Text style={styles.quizTitle}>{quiz.title}</Text>

                    {quiz.description && (
                        <Text style={styles.quizDescription}>{quiz.description}</Text>
                    )}

                    <View style={styles.quizStats}>
                        <View style={styles.statItem}>
                            <Ionicons name="help-circle-outline" size={24} color={colors.primary} />
                            <Text style={styles.statValue}>{totalQuestions}</Text>
                            <Text style={styles.statLabel}>Questions</Text>
                        </View>

                        {quiz.time_limit && (
                            <View style={styles.statItem}>
                                <Ionicons name="time-outline" size={24} color={colors.warning} />
                                <Text style={styles.statValue}>{quiz.time_limit}</Text>
                                <Text style={styles.statLabel}>Minutes</Text>
                            </View>
                        )}

                        <View style={styles.statItem}>
                            <Ionicons name="checkmark-circle-outline" size={24} color={colors.success} />
                            <Text style={styles.statValue}>{quiz.passing_score || 70}%</Text>
                            <Text style={styles.statLabel}>To Pass</Text>
                        </View>
                    </View>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity style={styles.startButton} onPress={startQuiz}>
                            <Text style={styles.startButtonText}>Start Quiz</Text>
                            <Ionicons name="arrow-forward" size={20} color={colors.surface} />
                        </TouchableOpacity>

                        {onCancel && (
                            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                                <Text style={styles.cancelButtonText}>Go Back</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </ScrollView>
        );
    }

    // Results Screen
    if (state === 'results' && result) {
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
                <View style={styles.resultsCard}>
                    <View style={[
                        styles.resultIconContainer,
                        { backgroundColor: result.passed ? colors.success + '20' : colors.error + '20' }
                    ]}>
                        <Ionicons
                            name={result.passed ? 'trophy' : 'refresh-circle'}
                            size={64}
                            color={result.passed ? colors.success : colors.error}
                        />
                    </View>

                    <Text style={styles.resultTitle}>
                        {result.passed ? 'Congratulations!' : 'Keep Trying!'}
                    </Text>

                    <Text style={styles.resultSubtitle}>
                        {result.passed
                            ? 'You have passed this quiz.'
                            : `You need ${quiz.passing_score || 70}% to pass.`}
                    </Text>

                    <View style={styles.scoreContainer}>
                        <View style={styles.scoreCircle}>
                            <Text style={[
                                styles.scorePercentage,
                                { color: result.passed ? colors.success : colors.error }
                            ]}>
                                {result.percentage}%
                            </Text>
                            <Text style={styles.scoreLabel}>
                                {result.score}/{result.totalPoints} points
                            </Text>
                        </View>
                    </View>

                    {showResults && (
                        <View style={styles.answersReview}>
                            <Text style={styles.reviewTitle}>Question Review</Text>
                            {quiz.questions.map((question, index) => {
                                const answerResult = result.answers[index];
                                return (
                                    <TouchableOpacity
                                        key={question.id}
                                        style={styles.reviewItem}
                                        onPress={() => setShowExplanation(
                                            showExplanation === question.id ? null : question.id
                                        )}
                                    >
                                        <View style={styles.reviewHeader}>
                                            <View style={[
                                                styles.reviewIcon,
                                                { backgroundColor: answerResult.correct ? colors.success + '20' : colors.error + '20' }
                                            ]}>
                                                <Ionicons
                                                    name={answerResult.correct ? 'checkmark' : 'close'}
                                                    size={16}
                                                    color={answerResult.correct ? colors.success : colors.error}
                                                />
                                            </View>
                                            <Text style={styles.reviewQuestion} numberOfLines={2}>
                                                {index + 1}. {question.question}
                                            </Text>
                                            <Ionicons
                                                name={showExplanation === question.id ? 'chevron-up' : 'chevron-down'}
                                                size={20}
                                                color={colors.textSecondary}
                                            />
                                        </View>

                                        {showExplanation === question.id && (
                                            <View style={styles.explanationContainer}>
                                                <Text style={styles.answerLabel}>
                                                    Your answer: {' '}
                                                    <Text style={{
                                                        color: answerResult.correct ? colors.success : colors.error,
                                                        fontWeight: Theme.fontWeight.bold,
                                                    }}>
                                                        {question.type === 'multiple_select'
                                                            ? (Array.isArray(answerResult.userAnswer) && answerResult.userAnswer.length > 0
                                                                ? (answerResult.userAnswer as number[]).map(i => getOptionText(question.options?.[i])).join(', ')
                                                                : 'No answer')
                                                            : question.type === 'multiple_choice'
                                                                ? getOptionText(question.options?.[answerResult.userAnswer as number])
                                                                : String(answerResult.userAnswer || 'No answer')}
                                                    </Text>
                                                </Text>
                                                {!answerResult.correct && (
                                                    <Text style={styles.correctAnswer}>
                                                        Correct answer: {' '}
                                                        <Text style={{ color: colors.success, fontWeight: Theme.fontWeight.bold }}>
                                                            {question.type === 'multiple_select'
                                                                ? (Array.isArray(answerResult.correctAnswer)
                                                                    ? (answerResult.correctAnswer as number[]).map(i => getOptionText(question.options?.[i])).join(', ')
                                                                    : getOptionText(question.options?.[answerResult.correctAnswer as number]))
                                                                : question.type === 'multiple_choice'
                                                                    ? getOptionText(question.options?.[answerResult.correctAnswer as number])
                                                                    : String(answerResult.correctAnswer)}
                                                        </Text>
                                                    </Text>
                                                )}
                                                {question.explanation && (
                                                    <Text style={styles.explanation}>
                                                        💡 {question.explanation}
                                                    </Text>
                                                )}
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    <View style={styles.resultButtonContainer}>
                        {quiz.allow_retry !== false && !result.passed && (
                            <TouchableOpacity style={styles.retryButton} onPress={retakeQuiz}>
                                <Ionicons name="refresh" size={20} color={colors.surface} />
                                <Text style={styles.retryButtonText}>Retry Quiz</Text>
                            </TouchableOpacity>
                        )}

                        {onCancel && (
                            <TouchableOpacity style={styles.continueButton} onPress={onCancel}>
                                <Text style={styles.continueButtonText}>Continue</Text>
                                <Ionicons name="arrow-forward" size={20} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </ScrollView>
        );
    }

    // Quiz Screen
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.quizHeader}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={onCancel} style={styles.exitButton}>
                        <Ionicons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>

                    {timeRemaining !== null && (
                        <View style={[
                            styles.timerContainer,
                            timeRemaining < 60 && styles.timerWarning
                        ]}>
                            <Ionicons
                                name="time-outline"
                                size={18}
                                color={timeRemaining < 60 ? colors.error : colors.text}
                            />
                            <Text style={[
                                styles.timerText,
                                timeRemaining < 60 && styles.timerWarningText
                            ]}>
                                {formatTime(timeRemaining)}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBarContainer}>
                    <Animated.View
                        style={[
                            styles.progressBarFill,
                            {
                                width: progressAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0%', '100%'],
                                }),
                            },
                        ]}
                    />
                </View>

                <Text style={styles.progressText}>
                    Question {currentQuestionIndex + 1} of {totalQuestions}
                </Text>
            </View>

            {/* Question */}
            <ScrollView style={styles.questionContainer} showsVerticalScrollIndicator={false}>
                <Animated.View
                    style={{
                        opacity: questionAnim,
                        transform: [
                            {
                                translateX: questionAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [30, 0],
                                }),
                            },
                        ],
                    }}
                >
                    <View style={styles.questionCard}>
                        <Text style={styles.questionText}>{currentQuestion.question}</Text>

                        {/* Options */}
                        <View style={styles.optionsContainer}>
                            {currentQuestion.type === 'multiple_choice' &&
                                currentQuestion.options?.map((option, index) => {
                                    // Handle both string and object options
                                    const optionText = typeof option === 'object' ? option.text : option;
                                    const isSelected = currentAnswer === index;
                                    const isCorrectOption = index === Number(currentQuestion.correct_answer);
                                    const showCorrect = isCurrentChecked && isCorrectOption;
                                    const showWrong = isCurrentChecked && isSelected && !isCorrectOption;

                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={[
                                                styles.optionButton,
                                                isSelected && !isCurrentChecked && styles.optionSelected,
                                                showCorrect && styles.optionCorrect,
                                                showWrong && styles.optionWrong,
                                            ]}
                                            onPress={() => selectAnswer(index)}
                                            activeOpacity={isCurrentChecked ? 1 : 0.8}
                                            disabled={isCurrentChecked}
                                        >
                                            <View style={[
                                                styles.optionIndicator,
                                                isSelected && !isCurrentChecked && styles.optionIndicatorSelected,
                                                showCorrect && styles.optionIndicatorCorrect,
                                                showWrong && styles.optionIndicatorWrong,
                                            ]}>
                                                {showCorrect ? (
                                                    <Ionicons name="checkmark" size={14} color={colors.surface} />
                                                ) : showWrong ? (
                                                    <Ionicons name="close" size={14} color={colors.surface} />
                                                ) : isSelected ? (
                                                    <Ionicons name="checkmark" size={14} color={colors.surface} />
                                                ) : (
                                                    <Text style={styles.optionLetter}>
                                                        {String.fromCharCode(65 + index)}
                                                    </Text>
                                                )}
                                            </View>
                                            <Text style={[
                                                styles.optionText,
                                                isSelected && !isCurrentChecked && styles.optionTextSelected,
                                                showCorrect && styles.optionTextCorrect,
                                                showWrong && styles.optionTextWrong,
                                            ]}>
                                                {optionText}
                                            </Text>
                                            {showCorrect && (
                                                <View style={styles.correctBadge}>
                                                    <Text style={styles.correctBadgeText}>Correct</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}

                            {/* Multiple Select - Allows selecting multiple answers */}
                            {currentQuestion.type === 'multiple_select' &&
                                currentQuestion.options?.map((option, index) => {
                                    const optionText = typeof option === 'object' ? option.text : option;
                                    const selectedAnswers = (currentAnswer as number[]) || [];
                                    const isSelected = selectedAnswers.includes(index);

                                    // Get all correct answer indices
                                    const correctAnswers = Array.isArray(currentQuestion.correct_answer)
                                        ? (currentQuestion.correct_answer as number[])
                                        : [currentQuestion.correct_answer as number];
                                    const isCorrectOption = correctAnswers.includes(index);
                                    const showCorrect = isCurrentChecked && isCorrectOption;
                                    const showWrong = isCurrentChecked && isSelected && !isCorrectOption;
                                    const showMissed = isCurrentChecked && !isSelected && isCorrectOption;

                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={[
                                                styles.optionButton,
                                                isSelected && !isCurrentChecked && styles.optionSelected,
                                                showCorrect && styles.optionCorrect,
                                                showWrong && styles.optionWrong,
                                                showMissed && styles.optionMissed,
                                            ]}
                                            onPress={() => selectAnswer(index)}
                                            activeOpacity={isCurrentChecked ? 1 : 0.8}
                                            disabled={isCurrentChecked}
                                        >
                                            <View style={[
                                                styles.checkboxIndicator,
                                                isSelected && !isCurrentChecked && styles.checkboxIndicatorSelected,
                                                showCorrect && styles.optionIndicatorCorrect,
                                                showWrong && styles.optionIndicatorWrong,
                                                showMissed && styles.optionIndicatorMissed,
                                            ]}>
                                                {showCorrect || (isSelected && !isCurrentChecked) ? (
                                                    <Ionicons name="checkmark" size={14} color={colors.surface} />
                                                ) : showWrong ? (
                                                    <Ionicons name="close" size={14} color={colors.surface} />
                                                ) : showMissed ? (
                                                    <Ionicons name="checkmark" size={14} color={colors.success} />
                                                ) : null}
                                            </View>
                                            <Text style={[
                                                styles.optionText,
                                                isSelected && !isCurrentChecked && styles.optionTextSelected,
                                                showCorrect && styles.optionTextCorrect,
                                                showWrong && styles.optionTextWrong,
                                            ]}>
                                                {optionText}
                                            </Text>
                                            {showCorrect && (
                                                <View style={styles.correctBadge}>
                                                    <Text style={styles.correctBadgeText}>Correct</Text>
                                                </View>
                                            )}
                                            {showMissed && (
                                                <View style={[styles.correctBadge, { backgroundColor: colors.warning }]}>
                                                    <Text style={styles.correctBadgeText}>Missed</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}

                            {/* Show hint for multiple select */}
                            {currentQuestion.type === 'multiple_select' && !isCurrentChecked && (
                                <Text style={styles.multiSelectHint}>
                                    Select all that apply
                                </Text>
                            )}

                            {currentQuestion.type === 'true_false' && (
                                <View style={styles.trueFalseContainer}>
                                    {['true', 'false'].map((value) => {
                                        const isSelected = currentAnswer === value;
                                        const isCorrectOption = value === String(currentQuestion.correct_answer);
                                        const showCorrect = isCurrentChecked && isCorrectOption;
                                        const showWrong = isCurrentChecked && isSelected && !isCorrectOption;

                                        return (
                                            <TouchableOpacity
                                                key={value}
                                                style={[
                                                    styles.trueFalseButton,
                                                    isSelected && !isCurrentChecked && (value === 'true' ? styles.trueFalseSelected : styles.trueFalseSelectedFalse),
                                                    showCorrect && styles.trueFalseCorrect,
                                                    showWrong && styles.trueFalseWrong,
                                                ]}
                                                onPress={() => selectAnswer(value)}
                                                disabled={isCurrentChecked}
                                            >
                                                <Ionicons
                                                    name={value === 'true' ? "checkmark-circle" : "close-circle"}
                                                    size={32}
                                                    color={
                                                        showCorrect ? colors.surface :
                                                            showWrong ? colors.surface :
                                                                isSelected ? colors.surface :
                                                                    value === 'true' ? colors.success : colors.error
                                                    }
                                                />
                                                <Text style={[
                                                    styles.trueFalseText,
                                                    (isSelected || showCorrect || showWrong) && styles.trueFalseTextSelected,
                                                ]}>
                                                    {value === 'true' ? 'True' : 'False'}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}

                            {/* Short answer / Text input */}
                            {currentQuestion.type === 'short_answer' && (
                                <View style={styles.shortAnswerContainer}>
                                    <TextInput
                                        style={[
                                            styles.shortAnswerInput,
                                            isCurrentChecked && styles.shortAnswerInputDisabled,
                                        ]}
                                        placeholder="Type your answer here..."
                                        placeholderTextColor={colors.textTertiary}
                                        value={currentAnswer?.toString() || ''}
                                        onChangeText={(text) => selectAnswer(text)}
                                        multiline={true}
                                        numberOfLines={4}
                                        textAlignVertical="top"
                                        editable={!isCurrentChecked}
                                    />
                                    {isCurrentChecked && (
                                        <View style={styles.shortAnswerFeedback}>
                                            <Text style={styles.correctAnswerLabel}>Correct answer:</Text>
                                            <Text style={styles.correctAnswerText}>{String(currentQuestion.correct_answer)}</Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* Check Answer Button - Shows above the feedback */}
                        {isCurrentAnswered && !isCurrentChecked && (
                            <TouchableOpacity
                                style={styles.checkAnswerButton}
                                onPress={checkCurrentAnswer}
                            >
                                <Ionicons name="checkmark-circle" size={20} color={colors.surface} />
                                <Text style={styles.checkAnswerButtonText}>Check Answer</Text>
                            </TouchableOpacity>
                        )}

                        {/* Feedback - Show after checking answer */}
                        {isCurrentChecked && (
                            <View style={[
                                styles.answerFeedback,
                                currentQuestionResult ? styles.answerFeedbackCorrect : styles.answerFeedbackWrong,
                            ]}>
                                <View style={styles.feedbackHeader}>
                                    <Ionicons
                                        name={currentQuestionResult ? "checkmark-circle" : "close-circle"}
                                        size={24}
                                        color={currentQuestionResult ? colors.success : colors.error}
                                    />
                                    <Text style={[
                                        styles.feedbackTitle,
                                        { color: currentQuestionResult ? colors.success : colors.error }
                                    ]}>
                                        {currentQuestionResult ? 'Correct!' : 'Incorrect'}
                                    </Text>
                                </View>
                                {currentQuestion.explanation && (
                                    <Text style={styles.feedbackText}>{currentQuestion.explanation}</Text>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Question Navigator - Moved outside the card for better visibility */}
                </Animated.View>
            </ScrollView>

            {/* Question Navigator Bar - Fixed position above footer */}
            <View style={styles.questionNavigatorBar}>
                <Text style={styles.navigatorLabel}>Questions:</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.navigatorContent}
                >
                    {quiz.questions.map((_, index) => {
                        const isAnswered = answers[index]?.answer !== null && answers[index]?.answer !== undefined;
                        const isChecked = checkedQuestions.has(index);
                        const isCorrect = questionResults.get(index);
                        const isCurrent = index === currentQuestionIndex;
                        return (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.navDot,
                                    isAnswered && !isChecked && styles.navDotAnswered,
                                    isChecked && isCorrect && styles.navDotCorrect,
                                    isChecked && !isCorrect && styles.navDotWrong,
                                    isCurrent && styles.navDotCurrent,
                                ]}
                                onPress={() => goToQuestion(index)}
                            >
                                <Text style={[
                                    styles.navDotText,
                                    (isAnswered || isCurrent || isChecked) && styles.navDotTextActive,
                                ]}>
                                    {index + 1}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Footer Navigation */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.navButton, currentQuestionIndex === 0 && styles.navButtonDisabled]}
                    onPress={goToPreviousQuestion}
                    disabled={currentQuestionIndex === 0}
                >
                    <Ionicons
                        name="chevron-back"
                        size={20}
                        color={currentQuestionIndex === 0 ? colors.textTertiary : colors.text}
                    />
                    <Text style={[
                        styles.navButtonText,
                        currentQuestionIndex === 0 && styles.navButtonTextDisabled,
                    ]}>
                        Previous
                    </Text>
                </TouchableOpacity>

                <View style={styles.footerCenter}>
                    <Text style={styles.footerProgress}>
                        {answeredCount}/{totalQuestions} answered
                    </Text>
                </View>

                <View style={styles.footerButtons}>
                    {currentQuestionIndex < totalQuestions - 1 ? (
                        <TouchableOpacity style={styles.nextButton} onPress={goToNextQuestion}>
                            <Text style={styles.nextButtonText}>Next</Text>
                            <Ionicons name="chevron-forward" size={20} color={colors.surface} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.finishButton}
                            onPress={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color={colors.surface} />
                            ) : (
                                <>
                                    <Text style={styles.finishButtonText}>Finish Quiz</Text>
                                    <Ionicons name="trophy" size={20} color={colors.surface} />
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
};

const createStyles = (colors: typeof Theme.colors.light, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    contentContainer: {
        padding: Theme.spacing.lg,
        paddingBottom: Theme.spacing['3xl'],
    },
    introCard: {
        backgroundColor: colors.surface,
        borderRadius: Theme.borderRadius.xl,
        padding: Theme.spacing.xl,
        alignItems: 'center',
        ...Theme.shadows[isDark ? 'dark' : 'light'].lg,
    },
    quizIconContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Theme.spacing.lg,
    },
    quizTitle: {
        fontSize: Theme.fontSize['2xl'],
        fontWeight: Theme.fontWeight.bold,
        color: colors.text,
        textAlign: 'center',
        marginBottom: Theme.spacing.sm,
    },
    quizDescription: {
        fontSize: Theme.fontSize.base,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: Theme.spacing.xl,
    },
    quizStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        paddingVertical: Theme.spacing.lg,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.border,
        marginBottom: Theme.spacing.xl,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: Theme.fontSize.xl,
        fontWeight: Theme.fontWeight.bold,
        color: colors.text,
        marginTop: Theme.spacing.xs,
    },
    statLabel: {
        fontSize: Theme.fontSize.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    buttonContainer: {
        width: '100%',
        gap: Theme.spacing.md,
    },
    startButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Theme.spacing.sm,
        backgroundColor: colors.primary,
        paddingVertical: Theme.spacing.md,
        borderRadius: Theme.borderRadius.lg,
        ...Theme.shadows[isDark ? 'dark' : 'light'].md,
    },
    startButtonText: {
        fontSize: Theme.fontSize.lg,
        fontWeight: Theme.fontWeight.bold,
        color: colors.surface,
    },
    cancelButton: {
        paddingVertical: Theme.spacing.md,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: Theme.fontSize.base,
        color: colors.textSecondary,
        fontWeight: Theme.fontWeight.medium,
    },
    quizHeader: {
        backgroundColor: colors.surface,
        paddingHorizontal: Theme.spacing.lg,
        paddingTop: Theme.spacing.md,
        paddingBottom: Theme.spacing.lg,
        ...Theme.shadows[isDark ? 'dark' : 'light'].sm,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Theme.spacing.md,
    },
    exitButton: {
        padding: Theme.spacing.xs,
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
        backgroundColor: colors.backgroundSecondary,
        paddingHorizontal: Theme.spacing.md,
        paddingVertical: Theme.spacing.xs,
        borderRadius: Theme.borderRadius.md,
    },
    timerWarning: {
        backgroundColor: colors.error + '20',
    },
    timerText: {
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.bold,
        color: colors.text,
    },
    timerWarningText: {
        color: colors.error,
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: colors.border,
        borderRadius: 3,
        marginBottom: Theme.spacing.sm,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 3,
    },
    progressText: {
        fontSize: Theme.fontSize.sm,
        color: colors.textSecondary,
        fontWeight: Theme.fontWeight.medium,
    },
    questionContainer: {
        flex: 1,
        padding: Theme.spacing.lg,
    },
    questionCard: {
        backgroundColor: colors.surface,
        borderRadius: Theme.borderRadius.xl,
        padding: Theme.spacing.xl,
        ...Theme.shadows[isDark ? 'dark' : 'light'].md,
    },
    questionText: {
        fontSize: Theme.fontSize.lg,
        fontWeight: Theme.fontWeight.semibold,
        color: colors.text,
        lineHeight: 26,
        marginBottom: Theme.spacing.xl,
    },
    optionsContainer: {
        gap: Theme.spacing.md,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Theme.spacing.md,
        backgroundColor: colors.backgroundSecondary,
        borderRadius: Theme.borderRadius.lg,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    optionSelected: {
        backgroundColor: colors.primary + '15',
        borderColor: colors.primary,
    },
    optionIndicator: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Theme.spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    optionIndicatorSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    optionIndicatorCorrect: {
        backgroundColor: colors.success,
        borderColor: colors.success,
    },
    optionIndicatorWrong: {
        backgroundColor: colors.error,
        borderColor: colors.error,
    },
    optionLetter: {
        fontSize: Theme.fontSize.sm,
        fontWeight: Theme.fontWeight.bold,
        color: colors.textSecondary,
    },
    optionText: {
        flex: 1,
        fontSize: Theme.fontSize.base,
        color: colors.text,
        lineHeight: 22,
    },
    optionTextSelected: {
        color: colors.primary,
        fontWeight: Theme.fontWeight.medium,
    },
    optionTextCorrect: {
        color: colors.success,
        fontWeight: Theme.fontWeight.medium,
    },
    optionTextWrong: {
        color: colors.error,
        fontWeight: Theme.fontWeight.medium,
    },
    optionCorrect: {
        backgroundColor: colors.success + '15',
        borderColor: colors.success,
    },
    optionWrong: {
        backgroundColor: colors.error + '15',
        borderColor: colors.error,
    },
    optionMissed: {
        backgroundColor: colors.warning + '10',
        borderColor: colors.warning,
        borderStyle: 'dashed',
    },

    // Checkbox style for multiple_select
    checkboxIndicator: {
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Theme.spacing.md,
        borderWidth: 2,
        borderColor: colors.border,
    },
    checkboxIndicatorSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    optionIndicatorMissed: {
        backgroundColor: colors.warning + '30',
        borderColor: colors.warning,
    },
    multiSelectHint: {
        marginTop: Theme.spacing.md,
        fontSize: Theme.fontSize.sm,
        color: colors.textSecondary,
        fontStyle: 'italic',
        textAlign: 'center',
    },

    correctBadge: {
        backgroundColor: colors.success,
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 2,
        borderRadius: Theme.borderRadius.sm,
        marginLeft: Theme.spacing.sm,
    },
    correctBadgeText: {
        color: colors.surface,
        fontSize: Theme.fontSize.xs,
        fontWeight: Theme.fontWeight.bold,
    },
    trueFalseContainer: {
        flexDirection: 'row',
        gap: Theme.spacing.md,
    },
    trueFalseButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Theme.spacing.xl,
        backgroundColor: colors.backgroundSecondary,
        borderRadius: Theme.borderRadius.lg,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    trueFalseSelected: {
        backgroundColor: colors.success,
        borderColor: colors.success,
    },
    trueFalseSelectedFalse: {
        backgroundColor: colors.error,
        borderColor: colors.error,
    },
    trueFalseCorrect: {
        backgroundColor: colors.success,
        borderColor: colors.success,
    },
    trueFalseWrong: {
        backgroundColor: colors.error,
        borderColor: colors.error,
    },
    trueFalseText: {
        fontSize: Theme.fontSize.lg,
        fontWeight: Theme.fontWeight.bold,
        color: colors.text,
        marginTop: Theme.spacing.sm,
    },
    trueFalseTextSelected: {
        color: colors.surface,
    },
    shortAnswerContainer: {
        width: '100%',
    },
    shortAnswerInput: {
        backgroundColor: colors.backgroundSecondary,
        borderRadius: Theme.borderRadius.lg,
        borderWidth: 2,
        borderColor: colors.border,
        padding: Theme.spacing.lg,
        fontSize: Theme.fontSize.base,
        color: colors.text,
        minHeight: 120,
        textAlignVertical: 'top',
    },
    shortAnswerInputDisabled: {
        backgroundColor: colors.border,
        opacity: 0.7,
    },
    shortAnswerFeedback: {
        marginTop: Theme.spacing.md,
        padding: Theme.spacing.md,
        backgroundColor: colors.success + '15',
        borderRadius: Theme.borderRadius.md,
    },
    correctAnswerLabel: {
        fontSize: Theme.fontSize.sm,
        color: colors.textSecondary,
        marginBottom: Theme.spacing.xs,
    },
    correctAnswerText: {
        fontSize: Theme.fontSize.base,
        color: colors.success,
        fontWeight: Theme.fontWeight.bold,
    },
    checkAnswerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Theme.spacing.sm,
        backgroundColor: colors.primary,
        paddingVertical: Theme.spacing.md,
        paddingHorizontal: Theme.spacing.xl,
        borderRadius: Theme.borderRadius.lg,
        marginTop: Theme.spacing.lg,
        ...Theme.shadows[isDark ? 'dark' : 'light'].md,
    },
    checkAnswerButtonText: {
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.bold,
        color: colors.surface,
    },
    answerFeedback: {
        marginTop: Theme.spacing.lg,
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.lg,
        borderLeftWidth: 4,
    },
    answerFeedbackCorrect: {
        backgroundColor: colors.success + '15',
        borderLeftColor: colors.success,
    },
    answerFeedbackWrong: {
        backgroundColor: colors.error + '15',
        borderLeftColor: colors.error,
    },
    instantFeedback: {
        marginTop: Theme.spacing.lg,
        padding: Theme.spacing.md,
        backgroundColor: colors.warning + '15',
        borderRadius: Theme.borderRadius.lg,
        borderLeftWidth: 4,
        borderLeftColor: colors.warning,
    },
    feedbackHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
        marginBottom: Theme.spacing.sm,
    },
    feedbackTitle: {
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.bold,
        color: colors.warning,
    },
    feedbackText: {
        fontSize: Theme.fontSize.sm,
        color: colors.text,
        lineHeight: 20,
    },
    questionNavigatorBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.backgroundSecondary,
        paddingVertical: Theme.spacing.sm,
        paddingHorizontal: Theme.spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    navigatorLabel: {
        fontSize: Theme.fontSize.xs,
        fontWeight: Theme.fontWeight.bold,
        color: colors.textSecondary,
        marginRight: Theme.spacing.sm,
    },
    navigatorContent: {
        paddingRight: Theme.spacing.md,
    },
    questionNavigator: {
        marginTop: Theme.spacing.xl,
        paddingVertical: Theme.spacing.md,
    },
    navDot: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.backgroundSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Theme.spacing.sm,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    navDotAnswered: {
        backgroundColor: colors.warning + '30',
    },
    navDotCorrect: {
        backgroundColor: colors.success,
    },
    navDotWrong: {
        backgroundColor: colors.error,
    },
    navDotCurrent: {
        borderColor: colors.primary,
        borderWidth: 3,
    },
    navDotText: {
        fontSize: Theme.fontSize.sm,
        fontWeight: Theme.fontWeight.bold,
        color: colors.textSecondary,
    },
    navDotTextActive: {
        color: colors.surface,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Theme.spacing.md,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    footerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    footerProgress: {
        fontSize: Theme.fontSize.sm,
        color: colors.textSecondary,
        fontWeight: Theme.fontWeight.medium,
    },
    footerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
    },
    navButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
        padding: Theme.spacing.md,
    },
    navButtonDisabled: {
        opacity: 0.5,
    },
    navButtonText: {
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.medium,
        color: colors.text,
    },
    navButtonTextDisabled: {
        color: colors.textTertiary,
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
        backgroundColor: colors.primary,
        paddingVertical: Theme.spacing.sm,
        paddingHorizontal: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.lg,
    },
    nextButtonText: {
        fontSize: Theme.fontSize.sm,
        fontWeight: Theme.fontWeight.bold,
        color: colors.surface,
    },
    finishButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
        backgroundColor: colors.success,
        paddingVertical: Theme.spacing.sm,
        paddingHorizontal: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.lg,
    },
    finishButtonText: {
        fontSize: Theme.fontSize.sm,
        fontWeight: Theme.fontWeight.bold,
        color: colors.surface,
    },
    finishHint: {
        paddingVertical: Theme.spacing.sm,
        paddingHorizontal: Theme.spacing.md,
    },
    finishHintText: {
        fontSize: Theme.fontSize.xs,
        color: colors.textTertiary,
        fontStyle: 'italic',
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
        backgroundColor: colors.success,
        paddingVertical: Theme.spacing.sm,
        paddingHorizontal: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.lg,
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitButtonPartial: {
        backgroundColor: colors.warning,
    },
    submitButtonText: {
        fontSize: Theme.fontSize.sm,
        fontWeight: Theme.fontWeight.bold,
        color: colors.surface,
    },
    resultsCard: {
        backgroundColor: colors.surface,
        borderRadius: Theme.borderRadius.xl,
        padding: Theme.spacing.xl,
        alignItems: 'center',
        ...Theme.shadows[isDark ? 'dark' : 'light'].lg,
    },
    resultIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Theme.spacing.lg,
    },
    resultTitle: {
        fontSize: Theme.fontSize['2xl'],
        fontWeight: Theme.fontWeight.bold,
        color: colors.text,
        marginBottom: Theme.spacing.xs,
    },
    resultSubtitle: {
        fontSize: Theme.fontSize.base,
        color: colors.textSecondary,
        marginBottom: Theme.spacing.xl,
    },
    scoreContainer: {
        marginBottom: Theme.spacing.xl,
    },
    scoreCircle: {
        alignItems: 'center',
    },
    scorePercentage: {
        fontSize: Theme.fontSize['6xl'],
        fontWeight: Theme.fontWeight.black,
    },
    scoreLabel: {
        fontSize: Theme.fontSize.base,
        color: colors.textSecondary,
        fontWeight: Theme.fontWeight.medium,
    },
    answersReview: {
        width: '100%',
        marginTop: Theme.spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: Theme.spacing.lg,
    },
    reviewTitle: {
        fontSize: Theme.fontSize.lg,
        fontWeight: Theme.fontWeight.bold,
        color: colors.text,
        marginBottom: Theme.spacing.md,
    },
    reviewItem: {
        backgroundColor: colors.backgroundSecondary,
        borderRadius: Theme.borderRadius.md,
        marginBottom: Theme.spacing.sm,
        overflow: 'hidden',
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Theme.spacing.md,
    },
    reviewIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Theme.spacing.sm,
    },
    reviewQuestion: {
        flex: 1,
        fontSize: Theme.fontSize.sm,
        color: colors.text,
        fontWeight: Theme.fontWeight.medium,
    },
    explanationContainer: {
        padding: Theme.spacing.md,
        paddingTop: 0,
        backgroundColor: colors.surface,
    },
    answerLabel: {
        fontSize: Theme.fontSize.sm,
        color: colors.textSecondary,
        marginBottom: Theme.spacing.xs,
    },
    correctAnswer: {
        fontSize: Theme.fontSize.sm,
        color: colors.textSecondary,
        marginBottom: Theme.spacing.sm,
    },
    explanation: {
        fontSize: Theme.fontSize.sm,
        color: colors.info,
        fontStyle: 'italic',
        marginTop: Theme.spacing.sm,
        padding: Theme.spacing.sm,
        backgroundColor: colors.info + '10',
        borderRadius: Theme.borderRadius.sm,
    },
    resultButtonContainer: {
        width: '100%',
        flexDirection: 'row',
        gap: Theme.spacing.md,
        marginTop: Theme.spacing.xl,
    },
    retryButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Theme.spacing.xs,
        backgroundColor: colors.primary,
        paddingVertical: Theme.spacing.md,
        borderRadius: Theme.borderRadius.lg,
    },
    retryButtonText: {
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.bold,
        color: colors.surface,
    },
    continueButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Theme.spacing.xs,
        backgroundColor: colors.backgroundSecondary,
        paddingVertical: Theme.spacing.md,
        borderRadius: Theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    continueButtonText: {
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.bold,
        color: colors.primary,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Theme.spacing.xl,
    },
    errorTitle: {
        fontSize: Theme.fontSize.xl,
        fontWeight: Theme.fontWeight.bold,
        color: colors.text,
        marginTop: Theme.spacing.lg,
        marginBottom: Theme.spacing.sm,
    },
    errorText: {
        fontSize: Theme.fontSize.base,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: Theme.spacing.xl,
    },
    errorBackButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: Theme.spacing.xl,
        paddingVertical: Theme.spacing.md,
        borderRadius: Theme.borderRadius.lg,
    },
    errorBackButtonText: {
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.bold,
        color: '#fff',
    },
});
