# TelegramHaushaltsBot

A simple Telegram bot that notifies users about household activities that are finished after they were started some time ago like starting the dishwasher or washing machine.

## Setup

1. Create Telegram bot
2. Copy the file [`example.config.json`](example.config.json) and rename it to `config.json`
3. Replace all placeholders in this file:
   - `telegramToken`: The Telegram bot token
4. Run `npm install`
5. Run `npm start`
6. Update the Telegram bot command/helper info with the information from the command line output (it should look a bit like the following):

   ```txt
   hilfe - Befehl und Bot Informationen/Hilfe
   starteWaschmaschine - Erinnere in 214 Minuten
   stoppeWaschmaschine - Stoppe aktuelle Erinnerung
   starteSpuelmaschine - Erinnere in 240 Minuten
   stoppeSpuelmaschine - Stoppe aktuelle Erinnerung
   ```
7. Play around
   - change the code
   - add new commands or edit them by just editing [`config.json`](example.config.json)
   - implement new user facing languages by adding to every `switch(language)` your language code and an implementation which also is necessary to do for the commands in [`config.json`](example.config.json) (also do not forget to change the `endUserLanguage` in it to your language code)

## Run on Raspberry Pi or Other Servers

1. Using `nohup` which will not restart the service if it crashes but continue to run even though the ssh console is closed again:

   ```sh
   # Start and save nohup process ID in local text file
   nohup npm start . > nohup_telegram_haushalts_bot.log &
   echo $! > nohup_telegram_haushalts_bot_pid.txt
   # Stop nohup process and remove local text file
   kill -9 `cat nohup_telegram_haushalts_bot_pid.txt`
   rm -f nohup_telegram_haushalts_bot_pid.txt
   ```
   **Attention:** The killing of the process does not seem to work - I currently need to go into `htop` search  with `F4` for `node` and kill the related process manually each time

## Create a Telegram Bot

[A link to the official Telegram instructions](https://core.telegram.org/bots#3-how-do-i-create-a-bot)

1. Create a Telegram account if you not already have one
2. Talk to the contact [BotFather](https://t.me/botfather) with the message `/newbot` and set thus a name for the bot and get a token to use it
3. Copy the token

## Add Telegram Bot Command Helpers/Info

[A link to Stackoverflow instructions](https://stackoverflow.com/questions/34457568/how-to-show-options-in-telegram-bot/34458436#34458436)

1. Talk again to the contact [BotFather](https://t.me/botfather) with the message `/setcommands`
2. Select your bot and send a message formatted as follows to enable command helpers/previews:

   ```txt
   start - Description 1
   menu - Description 2
   help - Description 3
   stop - Description 4
   ```

## TODOs

- [x] Implement basic reminders
- [x] Add command descriptions to basic reminders of Bot
- [x] Survive crash of bot (the reminders)
- [x] Only allow one waschmaschine/spuelmaschine to be run at once
- [x] Send messages if no one is answering until someone answers
- [x] Read token and other configurations from JSON files
- [x] Cancel Waschmaschine/Spülmaschine with command /stoppeSpuelmaschine and thus rename the others to /starteSpuelmaschine
- [x] Add some stats to slightly gamify the process
