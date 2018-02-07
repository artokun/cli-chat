const vorpal = require('vorpal')();
const firebase = require('firebase');
const inquirer = require('inquirer');
const clear = require('clui').Clear;
require('firebase/firestore');

const config = {
  apiKey: 'AIzaSyDNB0VRHot9Z3vxNBvxR9JDFIad2QbAY4Y',
  authDomain: 'system-builder-d9645.firebaseapp.com',
  databaseURL: 'https://system-builder-d9645.firebaseio.com',
  projectId: 'system-builder-d9645',
  storageBucket: 'system-builder-d9645.appspot.com',
  messagingSenderId: '521493369838',
};
firebase.initializeApp(config);
const db = firebase.firestore();

let user = {
  uid: '',
  username: 'anonymous',
};

let state = {
  roomId: '',
};

let instance = null;

firebase.auth().onAuthStateChanged(function(firebaseUser) {
  if (firebaseUser) {
    db
      .collection('user')
      .doc(firebaseUser.uid)
      .get()
      .then(doc => {
        user = {
          uid: doc.id,
          username: doc.data().username,
        };
        instance.delimiter('$cli-chat | ' + user.username + ':');
      });
    db
      .collection('messages')
      .orderBy('createdAt')
      .onSnapshot(snap => {
        clear();
        let string = '';
        snap.forEach(doc => {
          string = string + user.username + ': ' + doc.data().message + '\n';
        });
        instance.log(string);
      });
  } else {
    user = { uid: '', username: 'anonymous' };
  }
});

// commands
vorpal.command('/join').description('Choose a chat room');

vorpal
  .command('/login')
  .description('Log in')
  .action(function(args) {
    return inquirer
      .prompt([
        {
          type: 'input',
          name: 'email',
          message: 'Enter your email',
        },
        {
          type: 'password',
          name: 'password',
          message: 'Enter your password',
        },
      ])
      .then(({ email, password }) => {
        firebase
          .auth()
          .signInWithEmailAndPassword(email, password)
          .then(firebaseUser => {
            this.log('Successfully Logged in.');
            instance = this;
          })
          .catch(error => {
            var errorCode = error.code;

            if (errorCode === 'auth/invalid-email') {
              this.log(
                '\n  Email and Password combination does not exist. Please register.\n'
              );
            }
          });
      });
  });

vorpal
  .command('/register')
  .description('Register')
  .action(function(args) {
    return inquirer
      .prompt([
        {
          type: 'input',
          name: 'email',
          message: 'Enter your email',
        },
        {
          type: 'password',
          name: 'password',
          message: 'Enter your password',
        },
        {
          type: 'input',
          name: 'username',
          message: 'Choose a username',
        },
      ])
      .then(({ email, password, username }) => {
        firebase
          .auth()
          .createUserWithEmailAndPassword(email, password)
          .then(firebaseUser => {
            return db
              .collection('user')
              .doc(firebaseUser.uid)
              .set({ email, username });
          })
          .then(() => {
            this.log('Successfully Registered.');
            this.delimiter('$cli-chat | ' + config.username + ':');
          })
          .catch(error => {
            var errorCode = error.code;
            this.log(errorCode);
          });
      });
  });

vorpal.command('/user').action((args, cb) => {
  console.log(JSON.stringify(user, null, 2));
  cb();
});

vorpal.catch('[words...]', 'Chat').action(function(args, cb) {
  instance = this;
  if (!user.uid) {
    this.log('You need to `/login` or `/register` to chat');
    return cb();
  }
  return firebase
    .firestore()
    .collection('messages')
    .add({ message: args.words.join(' '), createdAt: Date.now() });
});

// show
vorpal.delimiter('$cli-chat').show();
