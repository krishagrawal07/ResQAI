const fs = require('fs');
const path = require('path');

const targetFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-background-actions',
  'android',
  'src',
  'main',
  'java',
  'com',
  'asterinet',
  'react',
  'bgactions',
  'RNBackgroundActionsTask.java',
);

if (!fs.existsSync(targetFile)) {
  console.log(
    '[postinstall] react-native-background-actions not found, skipping patch.',
  );
  process.exit(0);
}

const original = fs.readFileSync(targetFile, 'utf8');

if (
  original.includes(
    'notificationIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());',
  ) &&
  original.includes(
    'notificationIntent.setPackage(context.getPackageName());',
  ) &&
  !original.includes('PendingIntent.FLAG_MUTABLE')
) {
  console.log(
    '[postinstall] react-native-background-actions patch already applied.',
  );
  process.exit(0);
}

let updated = original;

updated = updated.replace(
  "            notificationIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(linkingURI));",
  "            notificationIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(linkingURI));\n            notificationIntent.setPackage(context.getPackageName());",
);

updated = updated.replace(
  "            notificationIntent = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);",
  "            notificationIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());\n            if (notificationIntent == null) {\n                notificationIntent = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);\n                notificationIntent.setPackage(context.getPackageName());\n            }",
);

updated = updated.replace(
  "        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {\n            contentIntent = PendingIntent.getActivity(context, 0, notificationIntent, PendingIntent.FLAG_MUTABLE);\n        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {",
  "        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {\n            contentIntent = PendingIntent.getActivity(context, 0, notificationIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);\n        } else {",
);

if (updated === original) {
  console.log(
    '[postinstall] react-native-background-actions patch already applied or library changed.',
  );
  process.exit(0);
}

fs.writeFileSync(targetFile, updated, 'utf8');
console.log('[postinstall] Patched react-native-background-actions for Android 14.');
