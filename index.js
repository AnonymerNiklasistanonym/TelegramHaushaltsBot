const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// Set paths to local files
const configFilePath = path.join(__dirname, 'config.json');
const configFilePathExample = path.join(__dirname, 'example.config.json');
const remindersFilePath = path.join(__dirname, 'reminders.json');
const statsFilePath = path.join(__dirname, 'stats.json');

// Check if configuration file exists
if (!fs.existsSync(configFilePath)) {
    console.error(`The file (${configFilePath}) that contains the configuration details (like the telegram token) was not found.`)
    console.error(`Rename the example file (${configFilePathExample}) to this name and update the necessary values in it.`)
    process.exit(1);
}

// If files do not exist create empty files
if (!fs.existsSync(remindersFilePath)) {
    fs.writeFileSync(remindersFilePath, JSON.stringify([]));
}
if (!fs.existsSync(statsFilePath)) {
    fs.writeFileSync(statsFilePath, JSON.stringify([]));
}

// Load configuration file
/** @type {{telegramToken:string,requireReplyNumberOfReminderMessages:number,requireReplyTimeBetweenReminderMessagesInMin:number,endUserLanguage:'de',reminderCommands:[{id:string,name:{de:string},commandPost:{de:string},waitTimeInMin:number}]}} */
const config = JSON.parse(fs.readFileSync(configFilePath).toString())

// Create global objects
// > Command info list
const reminderCommandsInfo = config.reminderCommands;
// > Reminder info list
/** @type {{chatId:number,machineType:string,startDate:Date,timeoutId?:NodeJS.Timeout}[]} */
const currentReminders = JSON.parse(fs.readFileSync(remindersFilePath).toString()).map(a => ({
    ...a,
    startDate: new Date(a.startDate)
}))
// > Stats info list
/** @type {{chatId:number,userStats:{userId:number,started:{date:Date,machineType:string}[],accepted:{date:Date,machineType:string,try:number}[],stopped:{date:Date,machineType:string}[]}[]}[]} */
const currentStats = JSON.parse(fs.readFileSync(statsFilePath).toString()).map(a => ({
    ...a,
    userStats: a.userStats.map(b => ({
        ...b,
        accepted: b.accepted.map(c => ({ ...c, date: new Date(c.date) })),
        started: b.started.map(c => ({ ...c, date: new Date(c.date) })),
        stopped: b.stopped.map(c => ({ ...c, date: new Date(c.date) }))
    }))
}));

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(config.telegramToken, {
    polling: true
});

// Output Telegram bot current command info based on the current config file
console.log('>>>>>>> Use the following text block to update the Telegram Bot command info <<<<<<<')
switch (config.endUserLanguage) {
    case 'de':
        console.log('hilfe - Befehl und Bot Hilfe');
        reminderCommandsInfo.map(a => {
            console.log(`starte${a.commandPost[config.endUserLanguage]} - Erinnere in ${a.waitTimeInMin} Minuten`);
        });
        reminderCommandsInfo.map(a => {
            console.log(`stoppe${a.commandPost[config.endUserLanguage]} - Stoppe die Erinnerung`);
            console.log(`status${a.commandPost[config.endUserLanguage]} - Status der Erinnerung`);
        });
        break;
    default:
        console.error(`The specified language (${config.endUserLanguage}) is not implemented`)
        process.exit(1);
}
console.log('>>>>>>> Use the previous text block to update the Telegram Bot command info  <<<<<<<')


/**
 * Update local reminder backup that will survive crashes
 * @param {'add'|'remove'} action What should be done
 * @param {number} chatId The chat id
 * @param {string} machineType The machine that was started
 * @param {Date} startDate The date when the reminder was started
 * @param {NodeJS.Timeout} timeoutId The timeout ID to stop a running timeout
 */
const updateReminders = async (action, chatId, machineType = undefined, startDate = undefined, timeoutId = undefined) => {
    switch (action) {
        case 'add':
            currentReminders.push({
                chatId,
                machineType,
                startDate,
                timeoutId
            });
            break;
        case 'remove':
            const existingElementIndex = currentReminders.findIndex(a => a.chatId === chatId && a.machineType === machineType);
            if (existingElementIndex < 0) {
                console.warn(`Running reminder timeout was not found (chatId='${chatId}', machineType='${machineType}')`);
            } else {
                console.log(`Clear running reminder timeout (${JSON.stringify(currentReminders[existingElementIndex])})`)
                clearTimeout(currentReminders[existingElementIndex].timeoutId);
                currentReminders.splice(existingElementIndex, 1);
            }
            break;
        default:
            console.error(`The specified action (${action}) is not implemented`)
            return process.exit(1);
    }
    await fs.promises.writeFile(remindersFilePath, JSON.stringify(currentReminders.map(a => ({
        chatId: a.chatId,
        machineType: a.machineType,
        startDate: a.startDate
    }))))
}

/**
 * AAAA
 * @param {number} chatId The chat where the reminder was requested
 * @param {Date} messageDate The date when the message was sent
 * @param {{id:string,name:{de:string},commandPost:{de:string},waitTimeInMin:number}} commandInfoElement
 * @param {boolean} isRestarted
 */
const createReminder = async (chatId, messageDate, commandInfoElement, isRestarted = false) => {
    // TODO Fix calculation to o
    const timeInMsTillReminder = (messageDate.getTime() + (commandInfoElement.waitTimeInMin * 60 * 1000)) - new Date().getTime();
    console.log("the timer will stop in", timeInMsTillReminder, Math.round(timeInMsTillReminder / 60 / 1000), messageDate.toTimeString())
    // Create timeout
    const timeoutId = setTimeout(async () => {
        updateReminders('remove', chatId, commandInfoElement.id);
        let replyRequired = Math.round(config.requireReplyNumberOfReminderMessages) > 0;
        let responseReminder = ''
        switch (config.endUserLanguage) {
            case 'de':
                responseReminder += `Die ${commandInfoElement.name[config.endUserLanguage]} ist fertig`;
                if (replyRequired) {
                    responseReminder += `\nWenn Zeit bitte dieser Nachricht antworten`;
                }
                break;
            default:
                console.error(`The specified language (${config.endUserLanguage}) is not implemented`)
                return process.exit(1);
        }
        const responseReminderMessage = await bot.sendMessage(chatId, responseReminder);
        if (replyRequired) {
            let someoneAcceptedTheResponsibility = false;
            let numberOfTimesTried = 0;
            const replyListeners = [];

            const reactToReply = async (msgReply) => {
                someoneAcceptedTheResponsibility = true;
                console.log(`Someone accepted the responsibility: '${JSON.stringify(msgReply)}`);
                await updateStats(msgReply.chat.id, msgReply.from?.id, commandInfoElement.id, 'accept', numberOfTimesTried);
                let responseToAcceptedReminder = ''
                switch (config.endUserLanguage) {
                    case 'de':
                        responseToAcceptedReminder += `${msgReply.from?.first_name} übernimmt die ${commandInfoElement.name[config.endUserLanguage]}`;
                        const countTimesAcceptedMachine = currentStats.find(a => a.chatId === chatId).userStats.find(b => b.userId === msgReply.from?.id).accepted.length;
                        responseToAcceptedReminder += `\n_${msgReply.from?.first_name} hat bezüglich ${commandInfoElement.name[config.endUserLanguage]} schon ${countTimesAcceptedMachine} mal geantwortet_`;
                        break;
                    default:
                        console.error(`The specified language (${config.endUserLanguage}) is not implemented`)
                        return process.exit(1);
                }
                await bot.sendMessage(chatId, responseToAcceptedReminder, { parse_mode: 'Markdown' });
            }

            replyListeners.push(bot.onReplyToMessage(chatId, responseReminderMessage.message_id, reactToReply));

            const recursiveTimeout = async (first = false) => {
                if (!someoneAcceptedTheResponsibility && numberOfTimesTried < config.requireReplyNumberOfReminderMessages) {
                    if (!first) {
                        numberOfTimesTried += 1;
                        let iTryOneMoreTimeMessage = ''
                        switch (config.endUserLanguage) {
                            case 'de':
                                iTryOneMoreTimeMessage += `Wie sieht es jetzt aus bezüglich: ${commandInfoElement.name[config.endUserLanguage]}???\n(Versuch #${numberOfTimesTried})`;
                                break;
                            default:
                                console.error(`The specified language (${config.endUserLanguage}) is not implemented`)
                                return process.exit(1);
                        }
                        const newReminderMessage = await bot.sendMessage(chatId, iTryOneMoreTimeMessage);
                        replyListeners.push(bot.onReplyToMessage(chatId, newReminderMessage.message_id, reactToReply));
                    }
                    setTimeout(recursiveTimeout, config.requireReplyTimeBetweenReminderMessagesInMin * 60 * 1000);
                } else {
                    if (!someoneAcceptedTheResponsibility && numberOfTimesTried >= config.requireReplyNumberOfReminderMessages) {
                        let iGiveUpMessage = '';
                        switch (config.endUserLanguage) {
                            case 'de':
                                iGiveUpMessage += "Ich gebe es auf darauf aufmerksam zu machen, weil niemand reagiert :(";
                                break;
                            default:
                                console.error(`The specified language (${config.endUserLanguage}) is not implemented`);
                                return process.exit(1);
                        }
                        await bot.sendMessage(chatId, iGiveUpMessage);
                    }
                    // Remove reply listener
                    for (const replyListener of replyListeners) {
                        bot.removeReplyListener(replyListener);
                    }
                }
            }
            await recursiveTimeout(true)

        }
    }, timeInMsTillReminder)
    // Save timeout to stop or revive after crash [if not already restarted from there]
    if (!isRestarted) {
        await updateReminders('add', chatId, commandInfoElement.id, messageDate, timeoutId);
    }
}

// TODO: Restart previous timers
for (let i = currentReminders.length - 1; i >= 0; i--) {
    // Get machine related information
    const commandInfoElement = reminderCommandsInfo.find(a => a.id === currentReminders[i].machineType);
    if (commandInfoElement === undefined) {
        console.error(`The specified machine (${currentReminders[i].machineType}) is not implemented`)
        process.exit(1);
    }
    // Calculate if timer is still running
    const timeStillToGoInMs = (currentReminders[i].startDate.getTime() + (Math.round(commandInfoElement.waitTimeInMin) * 60 * 1000)) - new Date().getTime();
    if (timeStillToGoInMs <= 0) {
        console.warn(`Timer already finished: '${JSON.stringify(currentReminders[i])}' > Remove it`)
        updateReminders('remove', currentReminders[i].chatId, currentReminders[i].machineType);
    } else {
        // TODO Restart timeout
        console.warn(`TODO Restart timer for '${Math.round(timeStillToGoInMs / 60 / 1000)}' min to go`)
        createReminder(currentReminders[i].chatId, currentReminders[i].startDate, commandInfoElement, true)
    }
}

/**
 * Help message response
 * @param {TelegramBot.Message} msg The request message
 * @param {'de'} language The end user language
 */
const responseHelp = async (msg, language = 'de') => {
    let response = ''
    switch (language) {
        case 'de':
            response += `
Es gibt die folgenden Befehle:
`;
            response += reminderCommandsInfo.map(a => `
*${a.name[language]}*:
- /starte${a.commandPost[language]}: _Erinnere in ${a.waitTimeInMin} Minuten_
- /stoppe${a.commandPost[language]}: _Stoppe die Erinnerung_
- /status${a.commandPost[language]}: _Status der Erinnerung_
            `).join('');
            break;
        default:
            console.error(`The specified language (${language}) is not implemented`)
            return process.exit(1);
    }
    return await bot.sendMessage(msg.chat.id, response, {
        parse_mode: 'Markdown'
    });
};

/**
 * Update user stats
 * @param {number} chatId
 * @param {number} userId
 * @param {string} machineType
 * @param {'start'|'stop'|'accept'} updateType
 * @param {number} numberOfTimesTried
 */
const updateStats = async (chatId, userId, machineType, updateType, numberOfTimesTried = undefined) => {
    const indexChat = currentStats.findIndex(a => a.chatId === chatId);
    console.info(`Index of chatId '${chatId}': ${indexChat}`);
    if (indexChat > -1) {
        const indexChatUser = currentStats[indexChat].userStats.findIndex(a => a.userId === userId);
        console.info(`Index of userId '${userId}': ${indexChatUser}`);
        if (indexChatUser > -1) {
            switch (updateType) {
                case 'start':
                    currentStats[indexChat].userStats[indexChatUser].started.push({ date: new Date(), machineType });
                    break;
                case 'stop':
                    currentStats[indexChat].userStats[indexChatUser].stopped.push({ date: new Date(), machineType });
                    break;
                case 'accept':
                    currentStats[indexChat].userStats[indexChatUser].accepted.push({ date: new Date(), machineType, try: numberOfTimesTried });
                    break;
                default:
                    console.error(`The specified updateType (${updateType}) is not implemented`)
                    return process.exit(1);
            }
        } else {
            console.info(`Create new user entry (chatId='${chatId}',userId='${userId}',machineType='${machineType}',updateType='${updateType}')`);
            // Add new entry for this chat user
            currentStats[indexChat].userStats.push({
                userId,
                started: updateType === "start" ? [{ date: new Date(), machineType }] : [],
                stopped: updateType === "stop" ? [{ date: new Date(), machineType }] : [],
                accepted: updateType === "accept" ? [{ date: new Date(), machineType, try: numberOfTimesTried }] : []
            })
        }
    } else {
        console.info(`Create new chat entry (chatId='${chatId}',userId='${userId}',machineType='${machineType}',updateType='${updateType}')`);
        // Add new entry for this chat
        currentStats.push({
            chatId,
            userStats: [{
                userId,
                started: updateType === "start" ? [{ date: new Date(), machineType }] : [],
                stopped: updateType === "stop" ? [{ date: new Date(), machineType }] : [],
                accepted: updateType === "accept" ? [{ date: new Date(), machineType, try: numberOfTimesTried }] : []
            }]
        })
    }
    await fs.promises.writeFile(statsFilePath, JSON.stringify(currentStats));
};

/**
 * Start timer message response
 * @param {TelegramBot.Message} msg
 * @param {string} machineType
 * @param {'de'} language
 */
const responseStartTimer = async (msg, machineType, language = 'de') => {
    // TODO Stop already running reminder timeout of chat by chatID
    const commandInfoElement = reminderCommandsInfo.find(a => a.id === machineType);
    if (commandInfoElement === undefined) {
        console.error(`The specified machine (${machineType}) is not implemented`)
        return process.exit(1);
    }
    await updateStats(msg.chat.id, msg.from?.id, machineType, 'start');
    let response = ''
    switch (language) {
        case 'de':
            response += `Die ${commandInfoElement.name[language]} wurde gestartet`;
            const timeReady = new Date(new Date().getTime() + (commandInfoElement.waitTimeInMin * 60 * 1000))
            response += `\n(Sie ist in ${commandInfoElement.waitTimeInMin} Minuten fertig - ${timeReady.toLocaleTimeString().substring(0,8).trim()})`;
            const countTimesStartedMachine = currentStats.find(a => a.chatId === msg.chat.id).userStats.find(b => b.userId === msg.from?.id).started.length;
            response += `\n_${msg.from?.first_name} hat ${commandInfoElement.name[language]} schon ${countTimesStartedMachine} mal gestartet_`;
            break;
        default:
            console.error(`The specified language (${language}) is not implemented`)
            return process.exit(1);
    }
    const responseSetReminder = await bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' });
    // Create timeout
    const timeoutId = createReminder(msg.chat.id, new Date(msg.date * 1000), commandInfoElement);
    // Save timeout to stop or revive after crash
    return responseSetReminder;
};

let helpCommand = '/';
switch (config.endUserLanguage) {
    case 'de':
        helpCommand += 'hilfe';
        break;
    default:
        console.error(`The specified language (${config.endUserLanguage}) is not implemented`);
        process.exit(1);
}
console.log(`Check messages for the the command: '${helpCommand}'`);
bot.onText(new RegExp(helpCommand), async (msg, match) => {
    const message = await responseHelp(msg, 'de');
    console.log(`I have sent a help message: ${JSON.stringify(message)}`)
});

for (const commandInfoElement of reminderCommandsInfo) {
    let commandStart = '/';
    let commandStatus = '/';
    let commandStop = '/';
    switch (config.endUserLanguage) {
        case 'de':
            commandStart += `starte${commandInfoElement.commandPost[config.endUserLanguage]}`;
            commandStatus += `status${commandInfoElement.commandPost[config.endUserLanguage]}`;
            commandStop += `stoppe${commandInfoElement.commandPost[config.endUserLanguage]}`;
            break;
        default:
            console.error(`The specified language (${config.endUserLanguage}) is not implemented`);
            process.exit(1);
    }
    console.log(`Check messages for the the commands: '${commandStart}', '${commandStatus}', '${commandStop}'`);
    bot.onText(new RegExp(commandStart), async (msg, match) => {
        const message = await responseStartTimer(msg, commandInfoElement.id, config.endUserLanguage);
        console.log(`I have sent a response to '/${commandStart}' message: ${JSON.stringify(message)}`)
    });
    bot.onText(new RegExp(commandStatus), async (msg, match) => {
        // TODO Get current running reminder timeout of chat by chatID
        // const message = await responseStartTimer(msg, commandInfoElement.id, config.endUserLanguage);
        // console.log(`TODO I have sent a response to '/${commandStatus}' message: ${JSON.stringify(message)}`)
    });
    bot.onText(new RegExp(commandStop), async (msg, match) => {
        // TODO Stop current running reminder timeout of chat by chatID
        // const message = await responseStartTimer(msg, commandInfoElement.id, config.endUserLanguage);
        // console.log(`TODO I have sent a response to '/${commandStop}' message: ${JSON.stringify(message)}`)
    });
}
