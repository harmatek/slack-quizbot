/**
 * This file is part of slack-quizbot package.
 *
 * Copyright (c) 2015 Harouna Madi <bonjour@harouna-madi.fr> (http://www.harouna-madi.fr)
 *
 * License
 * For full copyright and license information, please see the LICENSE
 * file that was distributed with this source code.
 */

'use strict';

const
    BOT_STATUS_DISABLED = 0,
    BOT_STATUS_ENABLED = 1,
    BOT_STATUS_START = 2,
    BOT_CMD_KEY = '!'
;

var QuizBot, Slack, Log, _, BotCMD, BotMessage, Vsprintf, Fs;

_ = require('underscore');
BotCMD = require('./src/cmd');
BotMessage = require('./src/messages');
Slack = require('slack-client');
Log = require('log');
Vsprintf = require("sprintf-js").vsprintf;
Fs = require("fs");

QuizBot = (function(){
    function QuizBot(config){
        var defaultOptions = {
            autoReconnect: true,
            autoMark: true,

            quizLimit: 25,
            quizStartTime: 15,
            quizNextQuestionDelay: 5,
            quizBasePoint: 5,
            channel: "game",

            databases: {
                "questions": "./data/questions.json",
                "scores": "./data/scores.json"
            }
        };

        this.config = _.extend(defaultOptions, config);
        this.logger = new Log(process.env.QUIZBOT_LOG_LEVEL || 'info');

        this.slack = {};
        this.message = {};
        this.botStatus = BOT_STATUS_ENABLED;
        this.questions = [];
        this.currentQuestion = {};
        this.score = [];
    };

    QuizBot.prototype.detectCommands = function (){
        var re = '^\\'+BOT_CMD_KEY+'([a-z]+)(\\s+(.*))?$';
        var re = new RegExp(re, "im");
        var match, message, cmd, cmdInfo, args;

        message = this.message.text;

        if ( (match = re.exec(_.escape(message))) !== null ) {
            if (match.index === re.lastIndex) {
                re.lastIndex++;
            }

            cmd = _.isString(match[1]) ? match[1].toLowerCase() : null;
            args = _.isString(match[3]) ? match[3] : null;

            if(cmd && _.isObject(BotCMD[cmd])){
                cmdInfo = BotCMD[cmd];

                if(this.message.isAdmin){
                    return this.executeCommand[cmdInfo.fn](args, this);
                }
                if(cmdInfo.public){
                    return this.executeCommand[cmdInfo.fn](args, this);
                }
            }
        }

        return QuizBot;
    };

    QuizBot.prototype.executeCommand = {
        disable: function(args, quizbot){
            if(quizbot.botStatus == BOT_STATUS_ENABLED) {
                quizbot.slack.setPresence('away');
                quizbot.botStatus = BOT_STATUS_DISABLED;
                quizbot.questions = [];
                quizbot.logger.info('QuizBot DISABLED');
            }

            return QuizBot;
        },
        enable: function(args, quizbot){
            if(quizbot.botStatus == BOT_STATUS_DISABLED) {
                quizbot.slack.setPresence('active');
                quizbot.botStatus = BOT_STATUS_ENABLED;
                quizbot.logger.info('QuizBot ENABLED');
            }

            return QuizBot;
        },
        start: function(args, quizbot){
            quizbot.config.quizStartTime = quizbot.config.quizStartTime < 5 ? 5 : quizbot.config.quizStartTime;

            if(quizbot.botStatus == BOT_STATUS_ENABLED){
                quizbot.prepareQuestions();

                if(quizbot.questions.length){
                    quizbot.botStatus = BOT_STATUS_START;
                    quizbot.logger.info('QuizBot START');
                    quizbot.message.channel.send(Vsprintf(BotMessage.bot_quizz_start, [quizbot.config.quizStartTime, quizbot.config.quizLimit]));
                    _.delay(function(){quizbot.askQuestion()}, quizbot.config.quizStartTime*1000);
                }else{
                    quizbot.message.channel.send(BotMessage.bot_no_questions);
                }
            }

            return QuizBot;
        },
        stop: function(args, quizbot){
            if(quizbot.botStatus == BOT_STATUS_START) {
                quizbot.botStatus = BOT_STATUS_ENABLED;
                quizbot.logger.info('QuizBot STOPPED');
                quizbot.message.channel = quizbot.slack.getChannelByName(quizbot.config.channel);
                quizbot.message.channel.send(BotMessage.bot_stopped);
            }

            return QuizBot;
        },
        score: function(args, quizbot){
            if(quizbot.botStatus == BOT_STATUS_ENABLED) {
                var user, userId, scores, list, i = 0;

                userId = quizbot.message.user.id;
                user = quizbot.slack.getUserByID(userId);

                if (!_.isUndefined(user)) {
                    try {
                        scores = JSON.parse(Fs.readFileSync(quizbot.config.databases.scores));
                        scores = _.sortBy(scores, 'score').reverse();

                        list = _.map(scores, function(item){
                            i++;
                            return (Vsprintf(BotMessage.bot_score_user, [i, item.username, item.score, i==1?' :sports_medal:':'']));
                        });

                        quizbot.slack.openDM(user.id, function (response) {
                            quizbot.message.channel = quizbot.slack.getChannelGroupOrDMByID(response.channel.id);
                            quizbot.message.channel.send("*[SCORE]*\n"+_.compact(list).join("\n"));
                            quizbot.slack.dms[response.channel.id].close();
                        });
                    } catch (e) {
                        console.error(e);
                    }
                }

                quizbot.message.channel = quizbot.slack.getChannelByName(quizbot.config.channel);
            }

            return QuizBot;
        },
        myscore: function(args, quizbot){
            if(quizbot.botStatus == BOT_STATUS_ENABLED) {
                var user, userId, scores, userScore;

                userId = quizbot.message.user.id;
                user = quizbot.slack.getUserByID(userId);

                if (!_.isUndefined(user)) {
                    try {
                        scores = JSON.parse(Fs.readFileSync(quizbot.config.databases.scores));
                        userScore = _.findWhere(scores, {"username": "@" + user.name});

                        if (!_.isUndefined(userScore)) {
                            quizbot.slack.openDM(user.id, function (response) {
                                quizbot.message.channel = quizbot.slack.getChannelGroupOrDMByID(response.channel.id);
                                quizbot.message.channel.send(Vsprintf(BotMessage.bot_my_score, [userScore.score]));
                                quizbot.slack.dms[response.channel.id].close();
                            });
                        } else {
                            quizbot.slack.openDM(user.id, function (response) {
                                quizbot.message.channel = quizbot.slack.getChannelGroupOrDMByID(response.channel.id);
                                quizbot.message.channel.send(Vsprintf(BotMessage.bot_my_score_null));
                                quizbot.slack.dms[response.channel.id].close();
                            });
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }

                quizbot.message.channel = quizbot.slack.getChannelByName(quizbot.config.channel);
            }

            return QuizBot;
        },
        help: function(args, quizbot){
            if(quizbot.botStatus != BOT_STATUS_DISABLED) {
                var cmds, userId, user;

                userId = quizbot.message.user.id;
                user = quizbot.slack.getUserByID(userId);

                if (!_.isUndefined(user)) {
                    cmds = _.mapObject(BotCMD, function (info, cmd) {
                        if(quizbot.message.isAdmin)
                            return "*" + BOT_CMD_KEY + cmd + "* : " + info.desc;
                        else if(info.public)
                            return "*" + BOT_CMD_KEY + cmd + "* : " + info.desc;
                        else
                            return null;
                    });

                    quizbot.slack.openDM(user.id, function (response) {
                        quizbot.message.channel = quizbot.slack.getChannelGroupOrDMByID(response.channel.id);
                        quizbot.message.channel.send("*[HELP]*\n" + _.compact(_.toArray(cmds)).join("\n"));
                        quizbot.slack.dms[response.channel.id].close();
                    });

                    quizbot.message.channel = quizbot.slack.getChannelByName(quizbot.config.channel);
                }
            }

            return QuizBot;
        }
    };

    QuizBot.prototype.prepareQuestions = function(){
        var contents = Fs.readFileSync(this.config.databases.questions);
        this.questions = _.first(_.shuffle(JSON.parse(contents)), this.config.quizLimit);

        return QuizBot;
    };

    QuizBot.prototype.askQuestion = function(){
        if(this.botStatus == BOT_STATUS_START && this.questions.length){
            this.currentQuestion = _.first(this.questions);
            this.questions = _.rest(this.questions);

            if(
                _.isEmpty(this.currentQuestion.question) ||
                _.isEmpty(this.currentQuestion.response) ||
                _.isUndefined(this.currentQuestion.question) ||
                _.isUndefined(this.currentQuestion.question)
            ){
                return this.askQuestion();
            }

            this.message.channel.send("*" + this.currentQuestion.question + "*");
        }

        return QuizBot;
    };

    QuizBot.prototype.checkResponse = function(){
        var re, result, response, message,
            congratulationDelay = 3000,
            responseDelay = 2000,
            quizbot = this;

        if(quizbot.botStatus == BOT_STATUS_START) {
            response = quizbot.currentQuestion.response;
            message = quizbot.message.text;
            re = new RegExp("("+response+")", 'gim');
            result = message.match(re);

            if(response && !_.isEmpty(result)){
                quizbot.message.channel.send(Vsprintf(BotMessage.right_answer, [quizbot.message.userName]));
                quizbot.scoreUpdate(quizbot.message.userName);

                _.delay(function(){
                    quizbot.message.channel.send(Vsprintf(BotMessage.give_answer, [response]));

                    _.delay(function(){
                        quizbot.message.channel.send(Vsprintf(BotMessage.next_question_in, [quizbot.config.quizNextQuestionDelay]));

                        _.delay(function(){
                            quizbot.askQuestion();
                        }, quizbot.config.quizNextQuestionDelay*1000);

                    }, congratulationDelay);

                }, responseDelay);
            }
        }

        return QuizBot;
    };

    QuizBot.prototype.scoreUpdate = function(username){
        var userScore, scores,
            quizbot = this
        ;

        quizbot.checkDatabases();

        try {
            scores = JSON.parse(Fs.readFileSync(quizbot.config.databases.scores));
        } catch (e){
            Fs.writeFileSync(quizbot.config.databases.scores, "[]", 'utf8');
            scores = JSON.parse(Fs.readFileSync(quizbot.config.databases.scores));
        }

        userScore = _.findWhere(scores, {"username": username});

        if(_.isUndefined(userScore)){
            scores.push({"username": username, "score": quizbot.config.quizBasePoint});
        }else{
            scores = _.filter(scores, function(user){
                return user.username != userScore.username;
            });
            scores.push({"username": username, "score":  parseInt(userScore.score)+quizbot.config.quizBasePoint});
        }

        try {
            Fs.writeFileSync(quizbot.config.databases.scores, JSON.stringify(scores), 'utf8');
        } catch (e){
            console.error(e);
        }

        return QuizBot;
    };

    QuizBot.prototype.checkDatabases = function() {
        _.each(this.config.databases, function(filename, dbname, list){
            Fs.access(filename, Fs.F_OK, function(err) {
                if(err) {
                    throw (err);
                }
            });
            Fs.access(filename, Fs.R_OK | Fs.W_OK, function(err) {
                if(err) {
                    throw (err);
                }
            });
        });

        return QuizBot;
    };

    QuizBot.prototype.connect = function(){
        var quizbot = this;

        this.slack = new Slack(quizbot.config.token, quizbot.config.autoReconnect, quizbot.config.autoMark);

        this.slack.on('open', function(){
            quizbot.logger.info('Connected to '+quizbot.slack.team.name+' team as '+quizbot.slack.self.name);
        });

        this.slack.on('message', function(message) {
            var response = '';

            quizbot.message.channel = quizbot.slack.getChannelGroupOrDMByID(message.channel);
            quizbot.message.user = quizbot.slack.getUserByID(message.user);
            quizbot.message.type = message.type, quizbot.message.ts = message.ts, quizbot.message.text = message.text;
            quizbot.message.channelName = (quizbot.message.channel != null ? quizbot.message.channel.is_channel : void 0) ? '#' : '';
            quizbot.message.channelName = quizbot.message.channelName + (quizbot.message.channel ? quizbot.message.channel.name : 'UNKNOWN_CHANNEL');
            quizbot.message.userName = (quizbot.message.user != null ? quizbot.message.user.name : void 0) != null ? "@" + quizbot.message.user.name : "UNKNOWN_USER";
            quizbot.message.isAdmin = _.find(quizbot.config.admin, function(id){
                if(quizbot.message.user != null)
                    return quizbot.message.user.id == id;
                return false;
            });
            quizbot.message.isAdmin = !quizbot.message.isAdmin || quizbot.message.isAdmin == 'undefined' ? false : true;

            quizbot.logger.info("Received: " + quizbot.message.type + " " + quizbot.message.channelName + " " + quizbot.message.userName + " " + quizbot.message.ts + " \"" + quizbot.message.text + "\"");

            if (quizbot.message.type === 'message' && (quizbot.message.text != null) && (quizbot.message.channel != null)) {
                quizbot.detectCommands();

                if(quizbot.botStatus == BOT_STATUS_DISABLED){
                    if(quizbot.message.channel.is_im){
                        if(quizbot.message.isAdmin){
                            response = BotMessage.bot_disabled_admin;
                        }else{
                            response = BotMessage.bot_disabled;
                        }

                        quizbot.message.channel.send(response);
                        quizbot.logger.info("@" + quizbot.slack.self.name + " responded with \"" + response + "\"");

                        return QuizBot;
                    }
                    return QuizBot;
                }

                if(quizbot.message.channel.name == quizbot.config.channel){
                    quizbot.checkResponse();
                }

                return QuizBot;
            } else {
                quizbot.message.typeError = type !== 'message' ? "unexpected type " + type + "." : null;
                quizbot.message.textError = text == null ? 'text was undefined.' : null;
                quizbot.message.channelError = channel == null ? 'channel was undefined.' : null;
                quizbot.message.errors = [quizbot.message.typeError, quizbot.message.textError, quizbot.message.channelError].filter(function(element) {
                    return element !== null;
                }).join(' ');

                quizbot.logger.info("@" + quizbot.slack.self.name + " could not respond. " + quizbot.message.errors);

                return QuizBot;
            }
        });

        this.slack.on('error', function(error) {
            return console.error("Error: " + error);
        });

        this.slack.login();

        return QuizBot;
    };

    QuizBot.prototype.initialize = function(){
        var quizbot = this;

        quizbot.checkDatabases();
        quizbot.connect();

        return QuizBot;
    };

    return QuizBot;
})();

module.exports = QuizBot;