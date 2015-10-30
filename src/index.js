var express = require('express');
var ejs = require('ejs');
var path = require('path');
var RSVP = require('RSVP');


var app = express();
app.engine('html', ejs.renderFile);


var testRunner = require('./test-runner');

app.set('views', path.join(__dirname, '../templates'));



function renderResponse(response, templateName, templateData) {
    return new RSVP.Promise(function(resolve, reject) {
        response.render(
            '../templates/' + templateName,
            templateData,
            function(error, renderedView) {
                if(error) {
                    reject(error);
                    return;
                }

                resolve(renderedView);
            }
        );
    });
}


app.get(
    '/tests',
    function (request, response, next) {
        testRunner.GETTests(request.url)
            .then(function(result) {
                return renderResponse(
                    response,
                    result.templateName,
                    result.templateData
                );
            })
            .then(function(renderedView) {
                response.send(renderedView);
            })
            .catch(function(error) {
                console.error(error);
                response.res.sendStatus(500);
            });
    }
);


module.exports = {
    addTestRenderers: testRunner.addTestRenderers.bind(testRunner),
    middleware: app,
    setDataAdapter: testRunner.setDataAdapter.bind(testRunner)
};
