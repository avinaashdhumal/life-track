const { withAndroidManifest, withPlugins } = require('@expo/config-plugins');

/**
 * Expo Config Plugin for LifeTrack Native Alarm Engine.
 * Injects required Android permissions, Foreground Service, FullScreen Intent Activity,
 * and BroadcastReceivers for AlarmManager and Boot events into AndroidManifest.xml.
 */
function withAlarmEnginePermissions(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    // Ensure permissions array exists
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }

    const permissionsToAdd = [
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.USE_EXACT_ALARM',
      'android.permission.USE_FULL_SCREEN_INTENT',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.WAKE_LOCK',
      'android.permission.VIBRATE',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS'
    ];

    const existingNames = new Set(
      androidManifest['uses-permission'].map(
        (p) => p.$ && p.$['android:name']
      )
    );

    for (const perm of permissionsToAdd) {
      if (!existingNames.has(perm)) {
        androidManifest['uses-permission'].push({
          $: {
            'android:name': perm
          }
        });
      }
    }

    // Ensure application element has AlarmFullScreenActivity and Receivers configured
    const application = androidManifest.application?.[0];
    if (application) {
      if (!application.activity) {
        application.activity = [];
      }
      const existingActivities = new Set(
        application.activity.map((a) => a.$ && a.$['android:name'])
      );

      if (!existingActivities.has('expo.modules.alarmengine.AlarmFullScreenActivity')) {
        application.activity.push({
          $: {
            'android:name': 'expo.modules.alarmengine.AlarmFullScreenActivity',
            'android:exported': 'true',
            'android:showWhenLocked': 'true',
            'android:turnScreenOn': 'true',
            'android:showOnLockScreen': 'true',
            'android:excludeFromRecents': 'true',
            'android:launchMode': 'singleInstance',
            'android:screenOrientation': 'portrait',
            'android:theme': '@style/Theme.AppCompat.NoActionBar'
          }
        });
      }

      // Foreground Service
      if (!application.service) {
        application.service = [];
      }
      const existingServices = new Set(
        application.service.map((s) => s.$ && s.$['android:name'])
      );

      if (!existingServices.has('expo.modules.alarmengine.AlarmForegroundService')) {
        application.service.push({
          $: {
            'android:name': 'expo.modules.alarmengine.AlarmForegroundService',
            'android:exported': 'false',
            'android:foregroundServiceType': 'specialUse'
          },
          property: [
            {
              $: {
                'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
                'android:value': 'LifeTrack scheduled alarms and reminders'
              }
            }
          ]
        });
      }

      if (!application.receiver) {
        application.receiver = [];
      }
      const existingReceivers = new Set(
        application.receiver.map((r) => r.$ && r.$['android:name'])
      );

      // Alarm Receiver
      if (!existingReceivers.has('expo.modules.alarmengine.AlarmReceiver')) {
        application.receiver.push({
          $: {
            'android:name': 'expo.modules.alarmengine.AlarmReceiver',
            'android:exported': 'false'
          },
          'intent-filter': [
            {
              action: [
                { $: { 'android:name': 'expo.modules.alarmengine.ALARM_TRIGGER' } },
                { $: { 'android:name': 'expo.modules.alarmengine.ACTION_TAKEN' } },
                { $: { 'android:name': 'expo.modules.alarmengine.ACTION_SNOOZE' } },
                { $: { 'android:name': 'expo.modules.alarmengine.ACTION_SKIP' } }
              ]
            }
          ]
        });
      }

      // Boot / Package Replaced Receiver
      if (!existingReceivers.has('expo.modules.alarmengine.BootReceiver')) {
        application.receiver.push({
          $: {
            'android:name': 'expo.modules.alarmengine.BootReceiver',
            'android:enabled': 'true',
            'android:exported': 'true'
          },
          'intent-filter': [
            {
              action: [
                { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
                { $: { 'android:name': 'android.intent.action.MY_PACKAGE_REPLACED' } },
                { $: { 'android:name': 'android.intent.action.TIME_SET' } },
                { $: { 'android:name': 'android.intent.action.TIMEZONE_CHANGED' } }
              ]
            }
          ]
        });
      }
    }

    return config;
  });
}

module.exports = function withAlarmEngine(config) {
  return withPlugins(config, [withAlarmEnginePermissions]);
};
