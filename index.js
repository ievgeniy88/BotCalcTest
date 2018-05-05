var userStates = {}; // TODO : Implement properly as state machine and use persistence storage (Redis for e.g.)

var keyboard = {
    'inline_keyboard' : [
        [ { text : '1', callback_data : '1' }, { text : '2', callback_data : '2' }, { text : '3', callback_data : '3' }, { text : '*', callback_data : '*' } ],
        [ { text : '4', callback_data : '4' }, { text : '5', callback_data : '5' }, { text : '6', callback_data : '6' }, { text : '/', callback_data : '/' } ],
        [ { text : '7', callback_data : '7' }, { text : '8', callback_data : '8' }, { text : '9', callback_data : '9' }, { text : '-', callback_data : '-' } ],
        [ { text : 'AC', callback_data : 'AC' }, { text : '0', callback_data : '0' }, { text : '=', callback_data : '=' }, { text : '+', callback_data : '+' } ]
    ]
}

var express = require('express'),
    https = require('https'),
    bodyParser = require('body-parser');

var app = express();

app.use(bodyParser.json());

// TODO : Implement properly with state machine
app.post('/webhook', async (req, res) => {
    var chatId = '';
    
    try
    {
        chatId = (req.body.callback_query || req.body).message.chat.id;
    }
    catch (ex)
    {
        console.log(ex);
        res.sendStatus(200);
        return;
    }

    try
    {
        if (!(chatId in userStates)) // TODO : Check message history
        {
            const result = await sendMessage(chatId, '0', keyboard);

            userStates[chatId] = {
                chatId : chatId,
                messageId : JSON.parse(result).result.message_id,
                first : '0',
                operator : null,
                second : '0',
                state : 'first'
            }
        }

        if (req.body.callback_query != undefined)
        {
            const data = req.body.callback_query.data;

            const userState = userStates[chatId];

            if ('0123456789'.indexOf(data) !== -1)
            {
                await processDigit(userState, data);
            }
            else if ('/*-+'.indexOf(data) !== -1)
            {
                await processOperator(userState, data);
            }
            else if (data == '=')
            {
                if (userState.state != 'first')
                {
                    var result = userState.second != '0'
                        ? eval(`${userState.first}${userState.operator}${userState.second}`)
                        : eval(`${userState.first}${userState.operator}${userState.first}`);
    
                    await editMessage(chatId, userState.messageId, keyboard, result);
    
                    userState.first = `${result}`;
                    userState.second = '0';
                    userState.operator = null;
                    userState.state = 'success'
                }
            }
            else if (data == 'AC')
            {
                await editMessage(chatId, userState.messageId, keyboard, 0);

                userState.first = '0';
                userState.second = '0';
                userState.operator = null;
                userState.state = 'first'
            }

            await answerCallbackQuery(req.body.callback_query.id);
        }    
    }
    catch (ex)
    {
        console.log(ex);        
    }
    finally
    {
        res.sendStatus(200);
    }
});

async function processDigit(userState, digit) {
    if (userState.state == 'first')
    {
        if (userState.first == '0')
        {
            userState.first = digit;
        }
        else
        {
            userState.first += digit;
        }

        await editMessage(userState.chatId, userState.messageId, keyboard, userState.first);
    }
    else if (userState.state == 'success')
    {
        userState.first = digit;
        await editMessage(userState.chatId, userState.messageId, keyboard, userState.first);
    }
    else
    {
        if (userState.second == '0')
        {
            userState.second = digit;
        }
        else
        {
            userState.second += digit;
        }

        await editMessage(userState.chatId, userState.messageId, keyboard, `${userState.first}${userState.operator}${userState.second}`);
    }
};

async function processOperator(userState, operator) {
    if (userState.state == 'first' || userState.state == 'success' || (userState.state == 'second' && userState.operator != operator))
    {
        userState.operator = operator;
        userState.state = 'second';

        await editMessage(userState.chatId, userState.messageId, keyboard, `${userState.first}${userState.operator}`);  
    }
    else
    {
        if (userState.second != '0')
        {
            var result = eval(`${userState.first}${userState.operator}${userState.second}`);

            userState.first = `${result}`;
            userState.second = '0';
            userState.operator = operator;
            userState.state = 'second'

            await editMessage(userState.chatId, userState.messageId, keyboard, `${userState.first}${userState.operator}`);
        }        
    }
};

app.listen(process.env.PORT || 3000, async function () {
    setWebhook('https://calcbottest.herokuapp.com/webhook').catch(ex => console.log(ex));
});

async function sendMessage(chatId, text, keyboard) {
    const data = {
        'chat_id' : chatId,
        'text': text,
        'reply_markup' : keyboard
    };
  
    return await asyncTelegramRequest(data, 'sendMessage');
}

async function editMessage(chatId, messageId, keyboard, text) {
    const data = {
        'chat_id' : chatId,
        'message_id' : messageId,
        'text': text,
        'reply_markup' : keyboard
    };

    return await asyncTelegramRequest(data, 'editMessageText');
}

async function setWebhook (url) {
    return await asyncTelegramRequest({ 'url' : url }, 'setWebhook');
}

async function answerCallbackQuery(queryId) {
    return await asyncTelegramRequest({ 'callback_query_id' : queryId }, 'answerCallbackQuery');
}

async function asyncTelegramRequest(data, method) {
    const requestData = JSON.stringify(data);
    
    const options = {
        protocol: 'https:',
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot575913070:AAHboWtBeqbtk-uZ25tN5_GzLaHdIyjmDas/${method}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestData)
        }
    };

    return new Promise((resolve, reject) => {
        var result = '';
  
        const callback = response => {
            response.on('data', chunk => result += chunk);
            response.on('end', () => response.statusCode == 200 ? resolve(result) : reject(new Error(result)));
        }

        var request = https.request(options, callback);
      
        request.on('error', (err) => reject(new Error(err)));

        request.end(requestData);
    })
}