
var Config = {
    "token": "", // bot token
    "admin": [] // admin user slack id
};
var QuizBot = require('slack-quizbot');

var quizbot = new QuizBot(Config);

quizbot.initialize();