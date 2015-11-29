# slack-quizbot

This is a QuizBot to use with [Slack](https://slack.com).

## Installation
```bash
npm install slack-quizbot
```

## Configuration

```javascript
token: "", // Your bot token
admin: [], // List of administrators who can perform special commands
autoReconnect: true, // Automatically reconnect after an error response from Slack.
autoMark: true, // Automatically mark each message as read after it is processed.
quizLimit: 25, // Number of questions
quizStartTime: 15, // Time (in seconds) before the first question
quizNextQuestionDelay: 5, // Time (in seconds) before asking the next question
quizBasePoint: 5, // Points earned per question
channel: "game", // Channel used for bot
databases: {
    "questions": "./data/questions.json", // Path to the database (json file) containing the questions
    "scores": "./data/scores.json" // Path to the database (json file) containing scores
}
```

## Usage

```javascript
var Config = {
    "token": "xoxb-219955200-k9fdgdfdf565Rt05566f",
    "admin": ["U07225LMPB", "U5KJJH0MPL"],
    "quizLimit": 45,
    "channel": "quizchan"
};
var QuizBot = require('slack-quizbot');
var quizbot = new QuizBot(Config);

quizbot.initialize();
```

## Commands

* **!enable** : Enable bot
* **!disable** : Disable bot
* **!start** : Start quiz
* **!stop** : Stops current quiz
* **!score** : Displays scores (DM)
* **!myscore** : Displays the user's score (DM)
* **!help** : Display help (DM)

## Examples

### Questions database
```json
[
    {"question":"\"Couleur menthe \u00e0 l'eau\" est l'une des chansons de ...","response":"Eddy Mitchell"},
    {"question":"\"Dreaming of me\" est l'un des \"singles\" de quel groupe","response":"Depeche Mode"},
    {"question":"\"Elle & Louis\" est le premier album solo de ....","response":"Louis Bertignac"},
    {"question":"\"La corrida de l'amour\" est le titre japonais d'une c\u00e9l\u00e8bre film, lequel","response":"L'empire de sens"}
]
```

### Scores database
```json
[
  {"username":"@jean","score":26},
  {"username":"@louis","score":15},
  {"username":"@marie","score":35}
]
```

## Copyright

Copyright &copy; Harouna Madi. MIT License; see LICENSE for further details.