var service = Ti.Android.currentService;
var serviceIntent = service.intent;
var timestamp = new Date(serviceIntent.getDoubleExtra('timestamp', 0));
var offset = serviceIntent.getIntExtra('offset', 0);
var sound = serviceIntent.getStringExtra('sound');

var alarmTimeIntent = Ti.Android.createIntent({
	className : 'org.appcelerator.titanium.TiActivity',
	packageName : 'com.sdfsdfwwer.sdfsdf',
	flags : Titanium.Android.FLAG_ACTIVITY_CLEAR_TOP | Titanium.Android.FLAG_ACTIVITY_SINGLE_TOP
});

var alarmTimePendingIntent = Ti.Android.createPendingIntent({
	activity : Ti.Android.currentActivity,
	intent : alarmTimeIntent,
	type : Ti.Android.PENDING_INTENT_FOR_ACTIVITY,
	flags : Titanium.Android.FLAG_CANCEL_CURRENT
});

foregroundNotify();
if (new Date() > timestamp) {
	var channel = Ti.Android.NotificationManager.createNotificationChannel({
		id: 'my_channel',
		name: 'Timer Channel',
		importance: Ti.Android.IMPORTANCE_DEFAULT,
		sound : sound ? Ti.Filesystem.resRawDirectory + sound : undefined,
	});

	var alarmTimeNotification = Titanium.Android.createNotification({
		contentIntent : alarmTimePendingIntent,
		contentTitle : 'Rest Time Complete!',
		channelId: channel.id,
		tickerText : 'sdfsdfwwer wer Mobile App',
		icon : Ti.App.Android.R.drawable.ic_stat_notification_icon,
		when : new Date()
	});
	if (require('bencoding.android.tools').createPlatform().isInForeground() == false) {
		Ti.Android.NotificationManager.notify(69, alarmTimeNotification);
	}
	foregroundCancel();
	Ti.Android.stopService(serviceIntent);
}

function foregroundNotify(){
	const timeDiff = parseInt((timestamp.getTime() - new Date().getTime())/1000)+offset;
	var channel2 = Ti.Android.NotificationManager.createNotificationChannel({
		id: 'my_channel_2',
		name: 'Timer Channel',
		importance: Ti.Android.IMPORTANCE_MIN,
	});

	var forgroundAlarmTimeNotification = Titanium.Android.createNotification({
		contentIntent : alarmTimePendingIntent,
		contentTitle : timeDiff + ' seconds until next set',
		channelId: channel2.id,
		tickerText : 'sdfsdfwwer wer Mobile App',
		icon : Ti.App.Android.R.drawable.ic_stat_notification_icon,
		when : new Date()
	});

	// Put this service into the foreground state.
	Ti.Android.currentService.foregroundNotify(999999, forgroundAlarmTimeNotification);
}

function foregroundCancel(){
	Ti.Android.currentService.foregroundCancel();
}
