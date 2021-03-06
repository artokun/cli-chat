const vorpal = require('vorpal')();
const firebase = require('firebase');
const inquirer = require('inquirer');
const clear = require('clui').Clear;
const notifier = require('node-notifier');
const Preferences = require('preferences');

require('firebase/firestore');
var prefs = new Preferences('com.cli-app', {
  user: {
    email: '',
    password: '',
    uid: '',
    username: '',
  },
});

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

let instance = null;

firebase.auth().onAuthStateChanged(function(firebaseUser) {
  if (firebaseUser) {
    db
      .collection('user')
      .doc(firebaseUser.uid)
      .get()
      .then(doc => {
        prefs.user = {
          ...prefs.user,
          uid: doc.id,
          email: firebaseUser.email,
          username: doc.data().username,
        };
        instance.delimiter('$cli-chat | ' + prefs.user.username + ':');
      });
    db
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(15)
      .onSnapshot(snap => {
        let string = [];
        snap.forEach(doc => {
          string.push(doc.data().username + ': ' + doc.data().message);
        });
        snap.docChanges.forEach(change => {
          if (change.type === 'added') {
            const { username, message } = change.doc.data();
            notifier.notify({
              title: username + ' said...',
              message: message,
            });
          }
        });
        clear();
        instance.log(string.reverse().join('\n'));
      });
  } else {
    user = { uid: '', username: 'anonymous' };
  }
});

// commands
vorpal.command('/join').description('Choose a chat room');

vorpal
  .command('/login [email] [password]')
  .description('Log in')
  .action(function({ email, password }) {
    instance = this;
    if (email && password) {
      return firebase
        .auth()
        .signInWithEmailAndPassword(email, password)
        .then(firebaseUser => {
          this.log('Successfully Logged in.');
          prefs.user.password = password;
          prefs.user.email = email;
        })
        .catch(error => {
          var errorCode = error.code;

          if (errorCode === 'auth/invalid-email') {
            this.log(
              '\n  Email and Password combination does not exist. Please register.\n'
            );
          }
        });
    }
    return inquirer
      .prompt([
        {
          type: 'input',
          name: 'email',
          message: 'Enter your email',
          default: email,
        },
        {
          type: 'password',
          name: 'password',
          message: 'Enter your password',
        },
      ])
      .then(({ email, password }) => {
        console.log(email, password);
        firebase
          .auth()
          .signInWithEmailAndPassword(email, password)
          .then(firebaseUser => {
            this.log('Successfully Logged in.');
            prefs.user.password = password;
            prefs.user.email = email;
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
    instance = this;
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
            prefs.user.username = username;
            prefs.user.password = password;
            prefs.user.email = email;
            this.delimiter('$cli-chat | ' + username + ':');
          })
          .catch(error => {
            var errorCode = error.code;
            this.log(errorCode);
          });
      });
  });

vorpal.command('/user').action((args, cb) => {
  console.log(JSON.stringify(prefs.user, null, 2));
  cb();
});

vorpal.catch('[words...]', 'Chat').action(function(args, cb) {
  instance = this;
  if (!prefs.user.uid) {
    this.log('You need to `/login` or `/register` to chat');
    return cb();
  }
  return firebase
    .firestore()
    .collection('messages')
    .add({
      message: args.words.join(' '),
      createdAt: Date.now(),
      username: prefs.user.username,
    });
});

// attempt auto login
if (prefs.user.email && prefs.user.password) {
  vorpal.exec(
    '/login ' + prefs.user.email + ' ' + prefs.user.password,
    function(err) {
      if (err) {
        prefs.user.email = '';
        prefs.user.password = '';
      }
    }
  );
}

// show
vorpal.delimiter('$cli-chat').show();
