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
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../lib/constants';

export interface QuizQuestion {
    id: string;
    question: string;
    type: 'multiple_choice' | 'true_false' | 'short_answer';
    options?: (string | { id: string; text: string; correct?: boolean })[];
    correct_answer: string | number;
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
    answer: string | number | null;
}

export interface QuizResult {
    score: number;
    totalPoints: number;
    percentage: number;
    passed: boolean;
    answers: {
        questionId: string;
        correct: boolean;
        userAnswer: string | number | null;
        correctAnswer: string | number;
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
        setAnswers(questions.map((q) => ({ questionId: q.id, answer: null })));
        setCurrentQuestionIndex(0);
        setResult(null);
        setCheckedQuestions(new Set());
        setQuestionResults(new Map());
        setState('quiz');
        if (quiz?.time_limit) {
            setTimeRemaining(quiz.time_limit * 60);
        }
    };

    const selectAnswer = (answer: string | number) => {
        if (!currentQuestion) return;
        // Don't allow changing answer if already checked
        if (checkedQuestions.has(currentQuestionIndex)) return;
        
        const newAnswers = [...answers];
        newAnswers[currentQuestionIndex] = {
            questionId: currentQuestion.id,
            answer,
        };
        setAnswers(newAnswers);
    };

    // NEW: Check/Submit current answer and show feedback
    const checkCurrentAnswer = () => {
        if (!currentQuestion || !isCurrentAnswered) return;
        if (checkedQuestions.has(currentQuestionIndex)) return;
        
        const userAnswer = answers[currentQuestionIndex]?.answer;
        const isCorrect = String(userAnswer) === String(currentQuestion.correct_answer);
        
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
            const isCorrect = String(userAnswer) === String(question.correct_answer);

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
    const isCurrentAnswered = currentAnswer !== null && currentAnswer !== undefined;

    // Count answered questions
    const answeredCount = answers.filter(a => a.answer !== null && a.answer !== undefined).length;

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
                    <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
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
                        <Ionicons name="clipboard" size={48} color={COLORS.primary} />
                    </View>
                    
                    <Text style={styles.quizTitle}>{quiz.title}</Text>
                    
                    {quiz.description && (
                        <Text style={styles.quizDescription}>{quiz.description}</Text>
                    )}

                    <View style={styles.quizStats}>
                        <View style={styles.statItem}>
                            <Ionicons name="help-circle-outline" size={24} color={COLORS.primary} />
                            <Text style={styles.statValue}>{totalQuestions}</Text>
                            <Text style={styles.statLabel}>Questions</Text>
                        </View>
                        
                        {quiz.time_limit && (
                            <View style={styles.statItem}>
                                <Ionicons name="time-outline" size={24} color={COLORS.warning} />
                                <Text style={styles.statValue}>{quiz.time_limit}</Text>
                                <Text style={styles.statLabel}>Minutes</Text>
                            </View>
                        )}
                        
                        <View style={styles.statItem}>
                            <Ionicons name="checkmark-circle-outline" size={24} color={COLORS.success} />
                            <Text style={styles.statValue}>{quiz.passing_score || 70}%</Text>
                            <Text style={styles.statLabel}>To Pass</Text>
                        </View>
                    </View>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity style={styles.startButton} onPress={startQuiz}>
                            <Text style={styles.startButtonText}>Start Quiz</Text>
                            <Ionicons name="arrow-forward" size={20} color={COLORS.surface} />
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
                        { backgroundColor: result.passed ? COLORS.success + '20' : COLORS.error + '20' }
                    ]}>
                        <Ionicons
                            name={result.passed ? 'trophy' : 'refresh-circle'}
                            size={64}
                            color={result.passed ? COLORS.success : COLORS.error}
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
                                { color: result.passed ? COLORS.success : COLORS.error }
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
                                                { backgroundColor: answerResult.correct ? COLORS.success + '20' : COLORS.error + '20' }
                                            ]}>
                                                <Ionicons
                                                    name={answerResult.correct ? 'checkmark' : 'close'}
                                                    size={16}
                                                    color={answerResult.correct ? COLORS.success : COLORS.error}
                                                />
                                            </View>
                                            <Text style={styles.reviewQuestion} numberOfLines={2}>
                                                {index + 1}. {question.question}
                                            </Text>
                                            <Ionicons
                                                name={showExplanation === question.id ? 'chevron-up' : 'chevron-down'}
                                                size={20}
                                                color={COLORS.textSecondary}
                                            />
                                        </View>
                                        
                                        {showExplanation === question.id && (
                                            <View style={styles.explanationContainer}>
                                                <Text style={styles.answerLabel}>
                                                    Your answer: {' '}
                                                    <Text style={{
                                                        color: answerResult.correct ? COLORS.success : COLORS.error,
                                                        fontWeight: FONT_WEIGHT.bold,
                                                    }}>
                                                        {question.type === 'multiple_choice'
                                                            ? getOptionText(question.options?.[answerResult.userAnswer as number])
                                                            : String(answerResult.userAnswer || 'No answer')}
                                                    </Text>
                                                </Text>
                                                {!answerResult.correct && (
                                                    <Text style={styles.correctAnswer}>
                                                        Correct answer: {' '}
                                                        <Text style={{ color: COLORS.success, fontWeight: FONT_WEIGHT.bold }}>
                                                            {question.type === 'multiple_choice'
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
                                <Ionicons name="refresh" size={20} color={COLORS.surface} />
                                <Text style={styles.retryButtonText}>Retry Quiz</Text>
                            </TouchableOpacity>
                        )}
                        
                        {onCancel && (
                            <TouchableOpacity style={styles.continueButton} onPress={onCancel}>
                                <Text style={styles.continueButtonText}>Continue</Text>
                                <Ionicons name="arrow-forward" size={20} color={COLORS.primary} />
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
                        <Ionicons name="close" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                    
                    {timeRemaining !== null && (
                        <View style={[
                            styles.timerContainer,
                            timeRemaining < 60 && styles.timerWarning
                        ]}>
                            <Ionicons
                                name="time-outline"
                                size={18}
                                color={timeRemaining < 60 ? COLORS.error : COLORS.text}
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
                                                    <Ionicons name="checkmark" size={14} color={COLORS.surface} />
                                                ) : showWrong ? (
                                                    <Ionicons name="close" size={14} color={COLORS.surface} />
                                                ) : isSelected ? (
                                                    <Ionicons name="checkmark" size={14} color={COLORS.surface} />
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
                                                        showCorrect ? COLORS.surface :
                                                        showWrong ? COLORS.surface :
                                                        isSelected ? COLORS.surface :
                                                        value === 'true' ? COLORS.success : COLORS.error
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
                                        placeholderTextColor={COLORS.textTertiary}
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
                                <Ionicons name="checkmark-circle" size={20} color={COLORS.surface} />
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
                                        color={currentQuestionResult ? COLORS.success : COLORS.error} 
                                    />
                                    <Text style={[
                                        styles.feedbackTitle,
                                        { color: currentQuestionResult ? COLORS.success : COLORS.error }
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
                        color={currentQuestionIndex === 0 ? COLORS.textTertiary : COLORS.text}
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
                            <Ionicons name="chevron-forward" size={20} color={COLORS.surface} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.finishButton}
                            onPress={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color={COLORS.surface} />
                            ) : (
                                <>
                                    <Text style={styles.finishButtonText}>Finish Quiz</Text>
                                    <Ionicons name="trophy" size={20} color={COLORS.surface} />
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    contentContainer: {
        padding: SPACING.lg,
        paddingBottom: SPACING.xxxl,
    },
    introCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.xl,
        alignItems: 'center',
        ...SHADOWS.lg,
    },
    quizIconContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: COLORS.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    quizTitle: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: SPACING.sm,
    },
    quizDescription: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: SPACING.xl,
    },
    quizStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        paddingVertical: SPACING.lg,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: COLORS.border,
        marginBottom: SPACING.xl,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginTop: SPACING.xs,
    },
    statLabel: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    buttonContainer: {
        width: '100%',
        gap: SPACING.md,
    },
    startButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        ...SHADOWS.md,
    },
    startButtonText: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.surface,
    },
    cancelButton: {
        paddingVertical: SPACING.md,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.medium,
    },
    quizHeader: {
        backgroundColor: COLORS.surface,
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.lg,
        ...SHADOWS.sm,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    exitButton: {
        padding: SPACING.xs,
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        backgroundColor: COLORS.backgroundSecondary,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.md,
    },
    timerWarning: {
        backgroundColor: COLORS.error + '20',
    },
    timerText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
    },
    timerWarningText: {
        color: COLORS.error,
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: COLORS.border,
        borderRadius: 3,
        marginBottom: SPACING.sm,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 3,
    },
    progressText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.medium,
    },
    questionContainer: {
        flex: 1,
        padding: SPACING.lg,
    },
    questionCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.xl,
        ...SHADOWS.md,
    },
    questionText: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
        lineHeight: 26,
        marginBottom: SPACING.xl,
    },
    optionsContainer: {
        gap: SPACING.md,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        backgroundColor: COLORS.backgroundSecondary,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    optionSelected: {
        backgroundColor: COLORS.primary + '15',
        borderColor: COLORS.primary,
    },
    optionIndicator: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    optionIndicatorSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    optionIndicatorCorrect: {
        backgroundColor: COLORS.success,
        borderColor: COLORS.success,
    },
    optionIndicatorWrong: {
        backgroundColor: COLORS.error,
        borderColor: COLORS.error,
    },
    optionLetter: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.textSecondary,
    },
    optionText: {
        flex: 1,
        fontSize: FONT_SIZE.md,
        color: COLORS.text,
        lineHeight: 22,
    },
    optionTextSelected: {
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.medium,
    },
    optionTextCorrect: {
        color: COLORS.success,
        fontWeight: FONT_WEIGHT.medium,
    },
    optionTextWrong: {
        color: COLORS.error,
        fontWeight: FONT_WEIGHT.medium,
    },
    optionCorrect: {
        backgroundColor: COLORS.success + '15',
        borderColor: COLORS.success,
    },
    optionWrong: {
        backgroundColor: COLORS.error + '15',
        borderColor: COLORS.error,
    },
    correctBadge: {
        backgroundColor: COLORS.success,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.sm,
        marginLeft: SPACING.sm,
    },
    correctBadgeText: {
        color: COLORS.surface,
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
    },
    trueFalseContainer: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    trueFalseButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
        backgroundColor: COLORS.backgroundSecondary,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    trueFalseSelected: {
        backgroundColor: COLORS.success,
        borderColor: COLORS.success,
    },
    trueFalseSelectedFalse: {
        backgroundColor: COLORS.error,
        borderColor: COLORS.error,
    },
    trueFalseCorrect: {
        backgroundColor: COLORS.success,
        borderColor: COLORS.success,
    },
    trueFalseWrong: {
        backgroundColor: COLORS.error,
        borderColor: COLORS.error,
    },
    trueFalseText: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginTop: SPACING.sm,
    },
    trueFalseTextSelected: {
        color: COLORS.surface,
    },
    shortAnswerContainer: {
        width: '100%',
    },
    shortAnswerInput: {
        backgroundColor: COLORS.backgroundSecondary,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 2,
        borderColor: COLORS.border,
        padding: SPACING.lg,
        fontSize: FONT_SIZE.md,
        color: COLORS.text,
        minHeight: 120,
        textAlignVertical: 'top',
    },
    shortAnswerInputDisabled: {
        backgroundColor: COLORS.border,
        opacity: 0.7,
    },
    shortAnswerFeedback: {
        marginTop: SPACING.md,
        padding: SPACING.md,
        backgroundColor: COLORS.success + '15',
        borderRadius: BORDER_RADIUS.md,
    },
    correctAnswerLabel: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
    },
    correctAnswerText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.success,
        fontWeight: FONT_WEIGHT.bold,
    },
    checkAnswerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.xl,
        borderRadius: BORDER_RADIUS.lg,
        marginTop: SPACING.lg,
        ...SHADOWS.md,
    },
    checkAnswerButtonText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.surface,
    },
    answerFeedback: {
        marginTop: SPACING.lg,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        borderLeftWidth: 4,
    },
    answerFeedbackCorrect: {
        backgroundColor: COLORS.success + '15',
        borderLeftColor: COLORS.success,
    },
    answerFeedbackWrong: {
        backgroundColor: COLORS.error + '15',
        borderLeftColor: COLORS.error,
    },
    instantFeedback: {
        marginTop: SPACING.lg,
        padding: SPACING.md,
        backgroundColor: COLORS.warning + '15',
        borderRadius: BORDER_RADIUS.lg,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.warning,
    },
    feedbackHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    feedbackTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.warning,
    },
    feedbackText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.text,
        lineHeight: 20,
    },
    questionNavigatorBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundSecondary,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    navigatorLabel: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.textSecondary,
        marginRight: SPACING.sm,
    },
    navigatorContent: {
        paddingRight: SPACING.md,
    },
    questionNavigator: {
        marginTop: SPACING.xl,
        paddingVertical: SPACING.md,
    },
    navDot: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.backgroundSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.sm,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    navDotAnswered: {
        backgroundColor: COLORS.warning + '30',
    },
    navDotCorrect: {
        backgroundColor: COLORS.success,
    },
    navDotWrong: {
        backgroundColor: COLORS.error,
    },
    navDotCurrent: {
        borderColor: COLORS.primary,
        borderWidth: 3,
    },
    navDotText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.textSecondary,
    },
    navDotTextActive: {
        color: COLORS.surface,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.md,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    footerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    footerProgress: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.medium,
    },
    footerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    navButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        padding: SPACING.md,
    },
    navButtonDisabled: {
        opacity: 0.5,
    },
    navButtonText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.medium,
        color: COLORS.text,
    },
    navButtonTextDisabled: {
        color: COLORS.textTertiary,
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
    },
    nextButtonText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.surface,
    },
    finishButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        backgroundColor: COLORS.success,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
    },
    finishButtonText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.surface,
    },
    finishHint: {
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
    },
    finishHintText: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textTertiary,
        fontStyle: 'italic',
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        backgroundColor: COLORS.success,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitButtonPartial: {
        backgroundColor: COLORS.warning,
    },
    submitButtonText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.surface,
    },
    resultsCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.xl,
        alignItems: 'center',
        ...SHADOWS.lg,
    },
    resultIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    resultTitle: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.xs,
    },
    resultSubtitle: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xl,
    },
    scoreContainer: {
        marginBottom: SPACING.xl,
    },
    scoreCircle: {
        alignItems: 'center',
    },
    scorePercentage: {
        fontSize: FONT_SIZE.display,
        fontWeight: FONT_WEIGHT.black,
    },
    scoreLabel: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.medium,
    },
    answersReview: {
        width: '100%',
        marginTop: SPACING.lg,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingTop: SPACING.lg,
    },
    reviewTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.md,
    },
    reviewItem: {
        backgroundColor: COLORS.backgroundSecondary,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.sm,
        overflow: 'hidden',
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
    },
    reviewIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.sm,
    },
    reviewQuestion: {
        flex: 1,
        fontSize: FONT_SIZE.sm,
        color: COLORS.text,
        fontWeight: FONT_WEIGHT.medium,
    },
    explanationContainer: {
        padding: SPACING.md,
        paddingTop: 0,
        backgroundColor: COLORS.surface,
    },
    answerLabel: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
    },
    correctAnswer: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    explanation: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.info,
        fontStyle: 'italic',
        marginTop: SPACING.sm,
        padding: SPACING.sm,
        backgroundColor: COLORS.info + '10',
        borderRadius: BORDER_RADIUS.sm,
    },
    resultButtonContainer: {
        width: '100%',
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.xl,
    },
    retryButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.xs,
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
    },
    retryButtonText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.surface,
    },
    continueButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.xs,
        backgroundColor: COLORS.backgroundSecondary,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    continueButtonText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.primary,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    errorTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginTop: SPACING.lg,
        marginBottom: SPACING.sm,
    },
    errorText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: SPACING.xl,
    },
    errorBackButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
    },
    errorBackButtonText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        color: '#fff',
    },
});
