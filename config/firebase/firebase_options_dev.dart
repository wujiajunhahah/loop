import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;

class DefaultFirebaseOptions {
  static final FirebaseOptions currentPlatform = FirebaseOptions(
    apiKey: 'AIzaSyDummyKeyForDev',
    appId: '1:1234567890:android:abcdef123456',
    messagingSenderId: '1234567890',
    projectId: 'omi-dev',
    storageBucket: 'omi-dev.appspot.com',
  );
}