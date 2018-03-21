var userStates = {};

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

app.post('/webhook', function (req, res) {
    const chatId = (req.body.callback_query || req.body).message.chat.id;
    
    if (!(chatId in userStates))
    {
        createClient(chatId); // TODO : Check message history
    }
    else if (req.body.callback_query != undefined)
    {
        const data = req.body.callback_query.data;
        
        const userState = userStates[chatId];

        if ('0123456789'.indexOf(data) !== -1)
        {
            processDigit(userState, data);
        }
        else if ('/*-+'.indexOf(data) !== -1)
        {
            processOperator(userState, data);
        }
        else if (data == '=')
        {
            if (userState.state != 'first')
            {
                var result = userState.second != '0'
                    ? eval(`${userState.first}${userState.operator}${userState.second}`)
                    : eval(`${userState.first}${userState.operator}${userState.first}`);

                editMessage(chatId, userState.messageId, keyboard, result);

                userState.first = `${result}`;
                userState.second = '0';
                userState.operator = null;
                userState.state = 'success'
            }
        }
        else if (data == 'AC')
        {
            editMessage(chatId, userState.messageId, keyboard, 0);

            userState.first = '0';
            userState.second = '0';
            userState.operator = null;
            userState.state = 'first'
        }
    }
    
    if (req.body.callback_query != undefined)
    {
        answerCallbackQuery(req.body.callback_query.id);
    }

    res.sendStatus(200);
});

var createClient = function (chatId) {
    sendMessage(chatId, '0', keyboard, function (messageId) {
        userStates[chatId] = {
            chatId : chatId,
            messageId : messageId,
            first : '0',
            operator : null,
            second : '0',
            state : 'first'
        }
    });
};

var processDigit = function (userState, digit) {
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

        editMessage(userState.chatId, userState.messageId, keyboard, userState.first);
    }
    else if (userState.state == 'success')
    {
        userState.first = digit;
        editMessage(userState.chatId, userState.messageId, keyboard, userState.first);
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

        editMessage(userState.chatId, userState.messageId, keyboard, `${userState.first}${userState.operator}${userState.second}`);
    }
};

var processOperator = function (userState, operator) {
    if (userState.state == 'first' || userState.state == 'success' || (userState.state == 'second' && userState.operator != operator))
    {
        userState.operator = operator;
        userState.state = 'second';

        editMessage(userState.chatId, userState.messageId, keyboard, `${userState.first}${userState.operator}`);  
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

            editMessage(userState.chatId, userState.messageId, keyboard, `${userState.first}${userState.operator}`);
        }        
    }
};

app.listen(3000, function () {
    setWebhook('https://bed39eb9.ngrok.io/webhook');
});

const sendMessage = function(chatId, text, keyboard, onSent) {
    const data = JSON.stringify({
        'chat_id' : chatId,
        'text': text,
        'reply_markup' : keyboard
    });
    
    console.log(data);
  
    const options = {
        protocol: 'https:',
        hostname: 'api.telegram.org',
        port: 443,
        path: '/bot575913070:AAHboWtBeqbtk-uZ25tN5_GzLaHdIyjmDas/sendMessage',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };
  
    var result = '';
  
    const callback = function(response) {
        response.on('data', function (chunk) {
            result += chunk;
        });
        response.on('end', function () {
            console.log(result);            
            onSent(JSON.parse(result).result.message_id);
        });
    }

    var request = https.request(options, callback);
  
    request.on('error', function(err) {
        console.log(err);
    });

    request.write(data);
    request.end();
}

const editMessage = function(chatId, messageId, keyboard, text) {
    const data = JSON.stringify({
        'chat_id' : chatId,
        'message_id' : messageId,
        'text': text,
        'reply_markup' : keyboard
    });
  
    const options = {
        protocol: 'https:',
        hostname: 'api.telegram.org',
        port: 443,
        path: '/bot575913070:AAHboWtBeqbtk-uZ25tN5_GzLaHdIyjmDas/editMessageText',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };
  
    var str = '';
  
    const callback = function(response) {
        response.on('data', function (chunk) {
            str += chunk;
        });
        response.on('end', function () {
            console.log(str);
        });
    }

    var request = https.request(options, callback);
  
    request.on('error', function(err) {
        console.log(err);
    });

    request.write(data);
    request.end();
}

const setWebhook = function(url) {
    const data = JSON.stringify({
        'url' : url
    });

    const options = {
        protocol: 'https:',
        hostname: 'api.telegram.org',
        port: 443,
        path: '/bot575913070:AAHboWtBeqbtk-uZ25tN5_GzLaHdIyjmDas/setWebhook',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };
  
    var str = '';
  
    const callback = function(response) {
        response.on('data', function (chunk) {
            str += chunk;
        });
        response.on('end', function () {
            console.log(str);
        });
    }

    var request = https.request(options, callback);
  
    request.on('error', function(err) {
        console.log(err);
    });

    request.write(data);
    request.end();
}

const answerCallbackQuery = function(queryId) {
    const data = JSON.stringify({
        'callback_query_id' : queryId
    });

    const options = {
        protocol: 'https:',
        hostname: 'api.telegram.org',
        port: 443,
        path: '/bot575913070:AAHboWtBeqbtk-uZ25tN5_GzLaHdIyjmDas/answerCallbackQuery',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };
  
    var str = '';
  
    const callback = function(response) {
        response.on('data', function (chunk) {
            str += chunk;
        });
        response.on('end', function () {
            console.log(str);
        });
    }

    var request = https.request(options, callback);
  
    request.on('error', function(err) {
        console.log(err);
    });

    request.write(data);
    request.end();
}