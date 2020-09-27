import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import path from "path";
import os from "os";
import { Language } from "./types";
import type { Config, ConfigReminderCommandsElement, CurrentReminder, CurrentStats, RemindersFileElement, StatsFileElement } from "./types";

// Set paths to local files
const configFilePath = path.join(__dirname, "..", "config.json");
const configFilePathExample = path.join(__dirname, "..", "example.config.json");
const remindersFilePath = path.join(__dirname, "..", "reminders.json");
const statsFilePath = path.join(__dirname, "..", "stats.json");

// Check if configuration file exists
if (!fs.existsSync(configFilePath)) {
    console.error(`The file (${configFilePath}) that contains the configuration details (like the telegram token) was not found.`);
    console.error(`Rename the example file (${configFilePathExample}) to this name and update the necessary values in it.`);
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
const config = JSON.parse(fs.readFileSync(configFilePath).toString()) as Config;

// Create global objects
// > Command info list
const reminderCommandsInfo = config.reminderCommands;
// > Reminder info list
const currentReminders: CurrentReminder[] = (JSON.parse(fs.readFileSync(remindersFilePath).toString()) as RemindersFileElement[]).map(a => ({
    ...a,
    // overwrite startDate string with date object
    startDate: new Date(a.startDate)
}));
// > Stats info list
const currentStats: CurrentStats[] = (JSON.parse(fs.readFileSync(statsFilePath).toString()) as StatsFileElement[]).map(a => ({
    ...a,
    userStats: a.userStats.map(b => ({
        ...b,
        accepted: b.accepted.map(c => ({ ...c, date: new Date(c.date) })),
        started: b.started.map(c => ({ ...c, date: new Date(c.date) })),
        stopped: b.stopped.map(c => ({ ...c, date: new Date(c.date) }))
    }))
}));
// > Bot start date
const botStartDate = new Date();

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(config.telegramToken, {
    polling: true
});

// Output Telegram bot current command info based on the current config file
console.log(">>>>>>> Use the following text block to update the Telegram Bot command info <<<<<<<");
switch (config.endUserLanguage) {
    case "de":
        console.log("hilfe - Befehl und Bot Hilfe");
        reminderCommandsInfo.map(a => {
            console.log(`starte${a.commandPost[config.endUserLanguage]} - Erinnere in ${a.waitTimeInMin} Minuten`);
        });
        reminderCommandsInfo.map(a => {
            console.log(`stoppe${a.commandPost[config.endUserLanguage]} - Stoppe die Erinnerung`);
            console.log(`status${a.commandPost[config.endUserLanguage]} - Status der Erinnerung`);
        });
        break;
    default:
        console.error(`The specified language (${config.endUserLanguage}) is not implemented`);
        process.exit(1);
}
console.log(">>>>>>> Use the previous text block to update the Telegram Bot command info  <<<<<<<");

/**
 * Update local reminder backup that will survive crashes
 * @param action What should be done
 * @param chatId The chat id
 * @param machineType The machine that was started
 * @param startDate The date when the reminder was started
 * @param timeoutId The timeout ID to stop a running timeout
 */
const updateReminders = async (action: "add"|"remove", chatId: number, machineType?: string, startDate?: Date, timeoutId?: NodeJS.Timeout) => {
    switch (action) {
        case "add":
            if (machineType === undefined || startDate === undefined || timeoutId === undefined) {
                throw Error(`Necessary arguments were undefined: machineType=${JSON.stringify(machineType)},startDate=${JSON.stringify(startDate)},timeoutId=${JSON.stringify(timeoutId)}`);
            }
            currentReminders.push({
                chatId,
                machineType,
                startDate,
                timeoutId
            });
            break;
        case "remove": {
            const existingElementIndex = currentReminders.findIndex(a => a.chatId === chatId && a.machineType === machineType);
            if (existingElementIndex < 0) {
                console.warn(`Running reminder timeout was not found (chatId='${chatId}', machineType='${JSON.stringify(machineType)}')`);
            } else {
                console.log(`Clear running reminder timeout (chatId='${chatId}', machineType='${JSON.stringify(machineType)}')`);
                const foundTimeoutId = currentReminders[existingElementIndex].timeoutId;
                if (foundTimeoutId !== undefined) {
                    clearTimeout(foundTimeoutId);
                }
                currentReminders.splice(existingElementIndex, 1);
            }
            break;
        }
        default:
            console.error(`The specified action (${JSON.stringify(action)}) is not implemented`);
            return process.exit(1);
    }
    await fs.promises.writeFile(remindersFilePath, JSON.stringify(currentReminders.map(a => ({
        chatId: a.chatId,
        machineType: a.machineType,
        startDate: a.startDate
    }))));
};

/**
 * AAAA
 * @param chatId The request message chat id
 * @param machineType
 * @param language
 */
const getStatus = async (chatId: number, machineType: string, language: Language = Language.DE) => {
    // Get machine related information
    const commandInfoElement = reminderCommandsInfo.find(a => a.id === machineType);
    if (commandInfoElement === undefined) {
        console.error(`The specified machine (${machineType}) is not implemented`);
        process.exit(1);
    }
    const currentReminder = currentReminders.find(a => a.chatId === chatId && a.machineType === machineType);
    if (currentReminder !== undefined) {
        // Found an active reminder
        let reminderFoundMessage = "";
        switch (language) {
            case "de": {
                reminderFoundMessage += `Es wurde eine Erinnerung bezüglich ${commandInfoElement.name[language]} gefunden:`;
                reminderFoundMessage += `\nSie wurde um ${currentReminder.startDate.toLocaleTimeString(language)} Uhr gestartet`;
                const newDate = new Date(currentReminder.startDate.getTime() + (commandInfoElement.waitTimeInMin * 60 * 1000));
                reminderFoundMessage += ` und endet um ${newDate.toLocaleTimeString(language)} Uhr`;
                break;
            }
            default:
                console.error(`The specified language (${language}) is not implemented`);
                return process.exit(1);
        }
        return await bot.sendMessage(chatId, reminderFoundMessage);
    } else {
        let noReminderFoundMessage = "";
        switch (language) {
            case "de":
                noReminderFoundMessage += `Es wurde aktuell keine Erinnerung bezüglich ${commandInfoElement.name[language]} gefunden`;
                break;
            default:
                console.error(`The specified language (${language}) is not implemented`);
                return process.exit(1);
        }
        return await bot.sendMessage(chatId, noReminderFoundMessage);
    }
};

/**
 * Update user stats
 * @param chatId
 * @param userId
 * @param machineType
 * @param updateType
 * @param numberOfTimesTried
 */
const updateStats = async (chatId: number, userId: number, machineType: string, updateType: "start"|"stop"|"accept", numberOfTimesTried?: number) => {
    const indexChat = currentStats.findIndex(a => a.chatId === chatId);
    console.info(`Index of chatId '${chatId}': ${indexChat}`);
    if (indexChat > -1) {
        const indexChatUser = currentStats[indexChat].userStats.findIndex(a => a.userId === userId);
        console.info(`Index of userId '${userId}': ${indexChatUser}`);
        if (indexChatUser > -1) {
            switch (updateType) {
                case "start":
                    currentStats[indexChat].userStats[indexChatUser].started.push({ date: new Date(), machineType });
                    break;
                case "stop":
                    currentStats[indexChat].userStats[indexChatUser].stopped.push({ date: new Date(), machineType });
                    break;
                case "accept":
                    if (numberOfTimesTried === undefined) {
                        throw Error("The argument numberOfTimesTried was undefined");
                    }
                    currentStats[indexChat].userStats[indexChatUser].accepted.push({ date: new Date(), machineType, try: numberOfTimesTried });
                    break;
                default:
                    console.error(`The specified updateType (${JSON.stringify(updateType)}) is not implemented`);
                    return process.exit(1);
            }
        } else {
            const accepted = [];
            if (updateType === "accept") {
                if (numberOfTimesTried === undefined) {
                    throw Error("The argument numberOfTimesTried was undefined");
                } else {
                    accepted.push({ date: new Date(), machineType, try: numberOfTimesTried });
                }
            }
            console.info(`Create new user entry (chatId='${chatId}',userId='${userId}',machineType='${machineType}',updateType='${updateType}')`);
            // Add new entry for this chat user
            currentStats[indexChat].userStats.push({
                userId,
                started: updateType === "start" ? [{ date: new Date(), machineType }] : [],
                stopped: updateType === "stop" ? [{ date: new Date(), machineType }] : [],
                accepted
            });
        }
    } else {
        const accepted = [];
        if (updateType === "accept") {
            if (numberOfTimesTried === undefined) {
                throw Error("The argument numberOfTimesTried was undefined");
            } else {
                accepted.push({ date: new Date(), machineType, try: numberOfTimesTried });
            }
        }
        console.info(`Create new chat entry (chatId='${chatId}',userId='${userId}',machineType='${machineType}',updateType='${updateType}')`);
        // Add new entry for this chat
        currentStats.push({
            chatId,
            userStats: [{
                userId,
                started: updateType === "start" ? [{ date: new Date(), machineType }] : [],
                stopped: updateType === "stop" ? [{ date: new Date(), machineType }] : [],
                accepted
            }]
        });
    }
    await fs.promises.writeFile(statsFilePath, JSON.stringify(currentStats));
};

/**
 * AAAA
 * @param chatId The request message chat id
 * @param chatId The request message chat user id
 * @param machineType
 * @param language
 * @param noMessageOnNotFound Do not send a message if no reminder is found
 */
const stopReminder = async (chatId: number, userId: number, machineType: string, language: Language = Language.DE, noMessageOnNotFound = false) => {
    // Get machine related information
    const commandInfoElement = reminderCommandsInfo.find(a => a.id === machineType);
    if (commandInfoElement === undefined) {
        console.error(`The specified machine (${machineType}) is not implemented`);
        process.exit(1);
    }
    const currentReminder = currentReminders.find(a => a.chatId === chatId && a.machineType === machineType);
    if (currentReminder !== undefined) {
        // Found an active reminder
        await updateStats(chatId, userId, machineType, "stop");
        await updateReminders("remove", chatId, machineType);
        let reminderFoundMessage = "";
        switch (language) {
            case "de": {
                reminderFoundMessage += `Die Erinnerung bezüglich ${commandInfoElement.name[language]} (gestartet um ${currentReminder.startDate.toLocaleTimeString(language)} Uhr) wurde gestoppt`;
                break;
            }
            default:
                console.error(`The specified language (${language}) is not implemented`);
                return process.exit(1);
        }
        return await bot.sendMessage(chatId, reminderFoundMessage);
    } else {
        if (!noMessageOnNotFound) {
            let noReminderFoundMessage = "";
            switch (language) {
                case "de":
                    noReminderFoundMessage += `Es wurde aktuell keine Erinnerung bezüglich ${commandInfoElement.name[language]} gefunden`;
                    break;
                default:
                    console.error(`The specified language (${language}) is not implemented`);
                    return process.exit(1);
            }
            return await bot.sendMessage(chatId, noReminderFoundMessage);
        }
    }
};

/**
 * AAAA
 * @param chatId The chat where the reminder was requested
 * @param messageDate The date when the message was sent
 * @param commandInfoElement
 * @param isRestarted
 */
const createReminder = async (chatId: number, messageDate: Date, commandInfoElement: ConfigReminderCommandsElement, isRestarted = false) => {
    // TODO Fix calculation to o
    const timeInMsTillReminder = (messageDate.getTime() + (commandInfoElement.waitTimeInMin * 60 * 1000)) - new Date().getTime();
    console.log("the timer will stop in", timeInMsTillReminder, Math.round(timeInMsTillReminder / 60 / 1000), messageDate.toTimeString());
    // Create timeout
    const timeoutId = setTimeout(async () => {
        await updateReminders("remove", chatId, commandInfoElement.id);
        const replyRequired = Math.round(config.requireReplyNumberOfReminderMessages) > 0;
        let responseReminder = "";
        switch (config.endUserLanguage) {
            case "de":
                responseReminder += `${commandInfoElement.name[config.endUserLanguage]} ist fertig`;
                if (replyRequired) {
                    responseReminder += "\nWenn Zeit bitte dieser Nachricht antworten";
                }
                break;
            default:
                console.error(`The specified language (${config.endUserLanguage}) is not implemented`);
                return process.exit(1);
        }
        const responseReminderMessage = await bot.sendMessage(chatId, responseReminder);
        if (replyRequired) {
            let someoneAcceptedTheResponsibility = false;
            let numberOfTimesTried = 0;
            const replyListeners: number[] = [];

            const reactToReply = async (msgReply: TelegramBot.Message) => {
                someoneAcceptedTheResponsibility = true;
                console.log(`Someone accepted the responsibility: '${JSON.stringify(msgReply)}`);
                const messageReplyFromID = msgReply.from?.id;
                if (messageReplyFromID === undefined) {
                    throw Error("Message reply from ID is undefined");
                }
                await updateStats(msgReply.chat.id, messageReplyFromID, commandInfoElement.id, "accept", numberOfTimesTried);
                let responseToAcceptedReminder = "";
                switch (config.endUserLanguage) {
                    case "de": {
                        const messageReplySentFrom = msgReply.from?.first_name;
                        if (messageReplySentFrom === undefined) {
                            throw Error("Message reply sent from was undefined");
                        }
                        responseToAcceptedReminder += `${messageReplySentFrom} übernimmt ${commandInfoElement.name[config.endUserLanguage]}`;
                        const countTimesAcceptedMachine = currentStats.find(a => a.chatId === chatId)?.userStats.find(b => b.userId === messageReplyFromID)?.accepted.length;
                        if (countTimesAcceptedMachine === undefined) {
                            throw Error("Count times accepted machine was undefined");
                        }
                        responseToAcceptedReminder += `\n_${messageReplySentFrom} hat bezüglich ${commandInfoElement.name[config.endUserLanguage]} schon ${countTimesAcceptedMachine} mal geantwortet_`;
                        break;
                    }
                    default:
                        console.error(`The specified language (${config.endUserLanguage}) is not implemented`);
                        return process.exit(1);
                }
                await bot.sendMessage(chatId, responseToAcceptedReminder, { parse_mode: "Markdown" });
            };

            replyListeners.push(bot.onReplyToMessage(chatId, responseReminderMessage.message_id, reactToReply));

            const recursiveTimeout = async (first = false) => {
                if (!someoneAcceptedTheResponsibility && numberOfTimesTried < config.requireReplyNumberOfReminderMessages) {
                    if (!first) {
                        numberOfTimesTried += 1;
                        let iTryOneMoreTimeMessage = "";
                        switch (config.endUserLanguage) {
                            case "de":
                                iTryOneMoreTimeMessage += `Wie sieht es jetzt aus bezüglich: ${commandInfoElement.name[config.endUserLanguage]}???\n(Versuch #${numberOfTimesTried})`;
                                break;
                            default:
                                console.error(`The specified language (${config.endUserLanguage}) is not implemented`);
                                return process.exit(1);
                        }
                        const newReminderMessage = await bot.sendMessage(chatId, iTryOneMoreTimeMessage);
                        replyListeners.push(bot.onReplyToMessage(chatId, newReminderMessage.message_id, reactToReply));
                    }
                    setTimeout(recursiveTimeout, config.requireReplyTimeBetweenReminderMessagesInMin * 60 * 1000);
                } else {
                    if (!someoneAcceptedTheResponsibility && numberOfTimesTried >= config.requireReplyNumberOfReminderMessages) {
                        let iGiveUpMessage = "";
                        switch (config.endUserLanguage) {
                            case "de":
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
            };
            await recursiveTimeout(true);
        }
    }, timeInMsTillReminder);
    // Save timeout to stop or revive after crash [if not already restarted from there]
    if (!isRestarted) {
        await updateReminders("add", chatId, commandInfoElement.id, messageDate, timeoutId);
    }
};

// TODO: Restart previous timers
for (let i = currentReminders.length - 1; i >= 0; i--) {
    // Get machine related information
    const commandInfoElement = reminderCommandsInfo.find(a => a.id === currentReminders[i].machineType);
    if (commandInfoElement === undefined) {
        console.error(`The specified machine (${currentReminders[i].machineType}) is not implemented`);
        process.exit(1);
    }
    // Calculate if timer is still running
    const timeStillToGoInMs = (currentReminders[i].startDate.getTime() + (Math.round(commandInfoElement.waitTimeInMin) * 60 * 1000)) - new Date().getTime();
    if (timeStillToGoInMs <= 0) {
        console.warn(`Timer already finished: '${JSON.stringify(currentReminders[i])}' > Remove it`);
        updateReminders("remove", currentReminders[i].chatId, currentReminders[i].machineType).catch(err => { throw err; });
    } else {
        // TODO Restart timeout
        console.warn(`TODO Restart timer for '${Math.round(timeStillToGoInMs / 60 / 1000)}' min to go`);
        createReminder(currentReminders[i].chatId, currentReminders[i].startDate, commandInfoElement, true).catch(err => { throw err; });
    }
}

/**
 * Help message response
 * @param msg The request message
 * @param language The end user language
 */
const responseHelp = async (msg: TelegramBot.Message, language: Language = Language.DE) => {
    let response = "";
    switch (language) {
        case Language.DE: {
            response += `
Es gibt die folgenden Befehle:
`;
            response += reminderCommandsInfo.map(a => `
*${a.name[language]}*:
- /starte${a.commandPost[language]}: _Erinnere in ${a.waitTimeInMin} Minuten_
- /stoppe${a.commandPost[language]}: _Stoppe die Erinnerung_
- /status${a.commandPost[language]}: _Status der Erinnerung_
            `).join("");

            const dayCount = Math.round(Math.abs((new Date().getTime() - botStartDate.getTime()) / (24 * 60 * 60 * 1000)));
            response += `\n_Der Bot läuft aktuell auf '${os.hostname()}' seit ${botStartDate.toLocaleString(language)} (${dayCount} Tage)_`;
            break;
        }
        default:
            console.error(`The specified language (${language}) is not implemented`);
            return process.exit(1);
    }
    return await bot.sendMessage(msg.chat.id, response, {
        parse_mode: "Markdown"
    });
};

/**
 * Start timer message response
 * @param msg
 * @param machineType
 * @param language
 */
const responseStartTimer = async (msg: TelegramBot.Message, machineType: string, language: Language = Language.DE) => {
    // TODO Stop already running reminder timeout of chat by chatID
    const commandInfoElement = reminderCommandsInfo.find(a => a.id === machineType);
    if (commandInfoElement === undefined) {
        console.error(`The specified machine (${machineType}) is not implemented`);
        return process.exit(1);
    }
    const messageFromId = msg.from?.id;
    if (messageFromId === undefined) {
        throw Error("Message from ID was undefined");
    }
    await updateStats(msg.chat.id, messageFromId, machineType, "start");
    let response = "";
    switch (language) {
        case "de": {
            response += `${commandInfoElement.name[language]} wurde gestartet`;
            const timeReady = new Date(new Date().getTime() + (commandInfoElement.waitTimeInMin * 60 * 1000));
            response += `\n(Ist in ${commandInfoElement.waitTimeInMin} Minuten fertig - ${timeReady.toLocaleTimeString(language)})`;
            const countTimesStartedMachine = currentStats.find(a => a.chatId === msg.chat.id)?.userStats.find(b => b.userId === messageFromId)?.started.length;
            if (countTimesStartedMachine === undefined) {
                throw Error("Count times started machine was undefined");
            }
            const messageSentFrom = msg.from?.first_name;
            if (messageSentFrom === undefined) {
                throw Error("Message sent from was undefined");
            }
            response += `\n_${messageSentFrom} hat ${commandInfoElement.name[language]} schon ${countTimesStartedMachine} mal gestartet_`;
            break;
        }
        default:
            console.error(`The specified language (${language}) is not implemented`);
            return process.exit(1);
    }
    const responseSetReminder = await bot.sendMessage(msg.chat.id, response, { parse_mode: "Markdown" });
    // Create timeout
    await createReminder(msg.chat.id, new Date(msg.date * 1000), commandInfoElement);
    // Save timeout to stop or revive after crash
    return responseSetReminder;
};

let helpCommand = "/";
switch (config.endUserLanguage) {
    case "de":
        helpCommand += "hilfe";
        break;
    default:
        console.error(`The specified language (${config.endUserLanguage}) is not implemented`);
        process.exit(1);
}
console.log(`Check messages for the the command: '${helpCommand}'`);
bot.onText(new RegExp(helpCommand), async (msg) => {
    const message = await responseHelp(msg, Language.DE);
    console.log(`I have sent a help message: ${JSON.stringify(message)}`);
});

for (const commandInfoElement of reminderCommandsInfo) {
    let commandStart = "/";
    let commandStatus = "/";
    let commandStop = "/";
    switch (config.endUserLanguage) {
        case "de":
            commandStart += `starte${commandInfoElement.commandPost[config.endUserLanguage]}`;
            commandStatus += `status${commandInfoElement.commandPost[config.endUserLanguage]}`;
            commandStop += `stoppe${commandInfoElement.commandPost[config.endUserLanguage]}`;
            break;
        default:
            console.error(`The specified language (${config.endUserLanguage}) is not implemented`);
            process.exit(1);
    }
    console.log(`Check messages for the the commands: '${commandStart}', '${commandStatus}', '${commandStop}'`);
    bot.onText(new RegExp(commandStart), async (msg) => {
        const messageFromId = msg?.from?.id;
        if (messageFromId === undefined) {
            throw Error("Message from ID is undefined");
        }
        const messageKillOldReminder = await stopReminder(msg.chat.id, messageFromId, commandInfoElement.id, config.endUserLanguage, true);
        if (messageKillOldReminder !== undefined) {
            console.log(`I have sent a response to '/${commandStart}' to kill old reminder message: ${JSON.stringify(messageKillOldReminder)}`);
        }
        const message = await responseStartTimer(msg, commandInfoElement.id, config.endUserLanguage);
        console.log(`I have sent a response to '/${commandStart}' message: ${JSON.stringify(message)}`);
    });
    bot.onText(new RegExp(commandStatus), async (msg) => {
        const message = await getStatus(msg.chat.id, commandInfoElement.id, config.endUserLanguage);
        console.log(`I have sent a response to '/${commandStatus}' message: ${JSON.stringify(message)}`);
    });
    bot.onText(new RegExp(commandStop), async (msg) => {
        const messageFromId = msg?.from?.id;
        if (messageFromId === undefined) {
            throw Error("Message from ID is undefined");
        }
        const message = await stopReminder(msg.chat.id, messageFromId, commandInfoElement.id, config.endUserLanguage);
        console.log(`I have sent a response to '/${commandStop}' message: ${JSON.stringify(message)}`);
    });
}
