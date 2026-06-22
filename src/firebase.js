import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey:            'AIzaSyCd3SybLIOqeaJ7Cwlxx4vhPPFDCwrqmvY',
  authDomain:        'relixia-6484d.firebaseapp.com',
  projectId:         'relixia-6484d',
  storageBucket:     'relixia-6484d.firebasestorage.app',
  messagingSenderId: '225567120510',
  appId:             '1:225567120510:web:9ea2b6cc27c0f5f4e78c2f',
  measurementId:     'G-9WK2QBK64J',
};

export const app       = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
