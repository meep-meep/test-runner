var fs = require('fs');
var path = require('path');

var express = require('express');
var ejs = require('ejs');
var RSVP = require('rsvp');
var queryString = require('queryString');


var _testRenderers = {};
var currentTestRunnerSessions = {};
var config = {
    'testLibrary': [],
    'testSuites': [],
    'reporter-url': '',
    'before-all': [],
    'after-all': []
};
var ALL_TAGS = '#all#';
var testSuiteRequest = '/tests';


var app = express();

app.set('views', path.join(__dirname, '../templates'));
app.engine('html', ejs.renderFile);


function rawContentToTag(rawContent) {
    if(/\.css$/.test(rawContent)) {
        return '<link rel="stylesheet" type="text/css" href="' + rawContent+ '"/>';
    }
    else if(/\.js$/.test(rawContent)) {
        return '<script type="text/javascript" src="' + rawContent + '"></script>';
    }
}

function getPageElement(pageElementName, params) {
    if(pageElementName in _testRenderers) {
        return _testRenderers[pageElementName].render(params);
    }
    return new RSVP.Promise(function(resolve, reject) {
        if(!params.rawContent) {
            reject(new Error('missing content in ' + pageElementName));
            return;
        }
        resolve(rawContentToTag(params.rawContent));
    });
}

function _formatPageElementData(pageElementData) {
    var result = {};
    if(!pageElementData) {
        return null;
    }
    if(typeof pageElementData === 'string') {
        if(pageElementData in _testRenderers) {
            result = {
                name: pageElementData,
                params: {}
            };
        }
        else {
            result = {
                params: {rawContent: pageElementData}
            };
        }
    }
    else if(typeof pageElementData === 'object') {
        for(elementName in pageElementData) {
            result.name = elementName;
            result.params = pageElementData[elementName];
        }
    }

    return result;
}

function _extend() {
    var result = {};
    var iterator;
    var currentObject;
    for(var i = 0 ; i < arguments.length ; i++) {
        currentObject = arguments[i];
        for(iterator in currentObject) {
            if(currentObject.hasOwnProperty(iterator)) {
                result[iterator] = currentObject[iterator];
            }
        }
    }
    return result;
}

function getTestSuitePageElements(pageElements, qs) {
    var preList = config['before-all'];
    var postList = config['after-all'];
    var fullElementList = preList.concat(pageElements.slice()).concat(postList);
    return RSVP.all(
        fullElementList.map(function(pageElementData) {
            pageElementData = _formatPageElementData(pageElementData);
            var params = _extend(pageElementData.params, qs);
            return getPageElement(pageElementData.name, params);
        })
    );
}

function renderResponse(response, templateName, templateData) {
    return new RSVP.Promise(function(resolve, reject) {
        response.render(
            templateName,
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

function formatTags(tagString) {
    if(typeof(tagString) !== 'string') {
        return [];
    }
    return tagString
        .split(',')
        .map(function(tag) {return tag.trim()});
}

function matchTags(candidates, reference) {
    if(candidates === ALL_TAGS) {
        return true;
    }
    return candidates.every(function(candidate) {
        return reference.indexOf(candidate) !== -1;
    });
}

function filterTestSuites(testsDefinition, tags) {
    var result = config.tests
        .filter(function(testSuite) {
            for(var testSuiteTags in testSuite) {
                if(tags === ALL_TAGS || matchTags(tags, formatTags(testSuiteTags))) {
                    return true;
                }
            }
        })
        .map(function(testSuite) {
            var transformedTestSuite;
            for(var testSuiteTags in testSuite) {
                transformedTestSuite = {
                    tags: testSuiteTags,
                    elements: testSuite[testSuiteTags]
                };
            }
            return transformedTestSuite;
        });
    return result;
}

function fillQueryString(qs) {
    if(!qs.env) {
        qs.env = 'prod';
    }

    if(!qs.testRunnerSession) {
        qs.testRunnerSession = +(new Date());
    }

    if(!qs.testIndex) {
        qs.testIndex = 0;
    }
    qs.reporterUrl = config['reporter-url'] + '?testRunnerSession=' + qs.testRunnerSession + '&testIndex=' + qs.testIndex;
}

function addTestRenderers(newTestRenderers) {
    for(var name in newTestRenderers) {
        _testRenderers[name] = newTestRenderers[name];
    }
}

function addTests(newTests) {
    config.tests = config.testLibrary.concat(newTests);
}

function addTestSuites(newTestDefinition) {
    config.testSuites = newTestDefinition;
}

function setConfig(key, value) {
    config[key] = value;
}

app.get(
    testSuiteRequest,
    function (request, response, next) {
        var qs = queryString.parse(request.url.split('?')[1]);
        var tags = formatTags(qs.tags);
        if(!tags.length) {
            tags = ALL_TAGS;
        }
        var testSuites = filterTestSuites(config, tags);

        fillQueryString(qs);

        if(qs.testIndex >= testSuites.length) {
            renderResponse(
                    response,
                    '../templates/done.html',
                    qs
                )
                .then(function(renderedView) {
                    response.send(renderedView);
                })
                .catch(function(error) {
                    console.error(error);
                    response.res.sendStatus(500);
                });
            return;
        }
        getTestSuitePageElements(testSuites[qs.testIndex].elements, qs)
            .then(function(pageElements) {
                return renderResponse(
                    response,
                    '../templates/template.html',
                    _extend(qs, {pageElements: pageElements, tags: testSuites[qs.testIndex].tags})
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

app.get(
    '/',
    function(request, response, next) {
        response.send('Sorry you need to specify test suite tags in your request as in : <b>' + testSuiteRequest + '</b>');
    }
);

function setBeforeAll(beforeAll) {
    config['before-all'] = beforeAll;
}

function setAfterAll(afterAll) {
    config['after-all'] = afterAll;
}

module.exports = {
    middleware: app,
    addTestRenderers: addTestRenderers,
    addTests: addTests,
    beforeAll: setBeforeAll,
    afterAll: setAfterAll,
    addTestSuites: addTestSuites,
    set: setConfig
};

