const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'assets', 'images', 'notification-icon.png');

const targets = [
  path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable', 'notification_icon.png'),
  path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable-mdpi', 'notification_icon.png'),
  path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable-hdpi', 'notification_icon.png'),
  path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable-xhdpi', 'notification_icon.png'),
  path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable-xxhdpi', 'notification_icon.png'),
  path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable-xxxhdpi', 'notification_icon.png'),
];

if (!fs.existsSync(source)) {
  console.error(`Notification icon not found at ${source}`);
  process.exit(1);
}

for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

console.log('Notification icon synced to Android drawable resources.');
