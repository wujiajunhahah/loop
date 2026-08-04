import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;

class DefaultFirebaseOptions {
  static final FirebaseOptions currentPlatform = FirebaseOptions(
    apiKey: 'AIzaSyDummyKeyForProd',
    appId: '1:0987654321:android:fedcba654321',
    messagingSenderId: '0987654321',
    projectId: 'omi-prod',
    storageBucket: 'omi-prod.appspot.com',
  );
}