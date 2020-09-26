export enum Language {
    DE="de",
    EN="en"
}

export interface Config {
    telegramToken: string
    requireReplyNumberOfReminderMessages: number
    requireReplyTimeBetweenReminderMessagesInMin: number
    endUserLanguage: Language
    reminderCommands: ConfigReminderCommandsElement[]
}
export interface ConfigReminderCommandsElement {
    id: string
    name: { [Language.DE]: string; [Language.EN]: string }
    commandPost: { [Language.DE]: string; [Language.EN]: string }
    waitTimeInMin: number
}

export interface RemindersFileElement {
    chatId: number
    machineType: string
    startDate: string
}

export interface CurrentReminder {
    chatId: number
    machineType: string
    startDate: Date
    // is undefined if just now imported
    timeoutId?: NodeJS.Timeout
}

export interface StatsFileElement {
    chatId: number
    userStats: StatsFileElementUserStatsElement[]
}
interface StatsFileElementUserStatsElement {
    userId: number
    started: StatsFileElementUserStatsElementDateMachineType[]
    accepted: StatsFileElementUserStatsElementDateMachineTypeAccepted[]
    stopped: StatsFileElementUserStatsElementDateMachineType[]
}
interface StatsFileElementUserStatsElementDateMachineType {
    date: string
    machineType: string
}
interface StatsFileElementUserStatsElementDateMachineTypeAccepted extends StatsFileElementUserStatsElementDateMachineType {
    try: number
}

export interface CurrentStats {
    chatId: number
    userStats: CurrentStatsUserStats[]
}
interface CurrentStatsUserStats {
    userId: number
    started: CurrentStatsUserStatsBasic[]
    accepted: CurrentStatsUserStatsExtended[]
    stopped: CurrentStatsUserStatsBasic[]
}
interface CurrentStatsUserStatsBasic {
    date: Date
    machineType: string
}
interface CurrentStatsUserStatsExtended extends CurrentStatsUserStatsBasic {
    try: number
}
