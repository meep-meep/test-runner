var fs = require('fs');
var path = require('path');

var express = require('express');
var ejs = require('ejs');
var RSVP = require('rsvp');
var queryString = require('querystring');
var shallowExtend = require('shallow-extend');


var ALL_TAGS = '#all#';

var _testRenderers = {};
var _dataAdapter = null;


var app = express();

app.set('views', path.join(__dirname, '../templates'));
app.engine('html', ejs.renderFile);


function setDataAdapter(dataAdapter) {
    _dataAdapter = dataAdapter;
}

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

function getTestSuitePageElements(pageElements, qs) {
    return RSVP.hash({
            'before-all': _dataAdapter.get('tests/before-all'),
            'after-all': _dataAdapter.get('tests/after-all')
        })
        .then(function(hash) {
            var preList = hash['before-all'];
            var postList = hash['after-all'];
            var fullElementList = preList.concat(pageElements.slice()).concat(postList);
            return RSVP.all(
                fullElementList.map(function(pageElementData) {
                    pageElementData = _formatPageElementData(pageElementData);
                    var params = shallowExtend({}, pageElementData.params, qs);
                    return getPageElement(pageElementData.name, params);
                })
            );
            
        })
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
        .map(function(tag) {return tag.trim().toLowerCase()});
}

function matchTags(candidates, reference) {
    if(candidates === ALL_TAGS) {
        return true;
    }
    return candidates.every(function(candidate) {
        return reference.indexOf(candidate) !== -1;
    });
}

function getfilteredTests(tags) {
    return _dataAdapter.get('tests/library')
        .then(function(testLibrary) {
            return testLibrary.filter(function(test) {
                for(var testTags in test) {
                    if(tags === ALL_TAGS || matchTags(tags, formatTags(testTags))) {
                        return true;
                    }
                }
            })
            .map(function(test) {
                var transformedTest;
                for(var testTags in test) {
                    transformedTest = {
                        tags: testTags,
                        elements: test[testTags]
                    };
                }
                return transformedTest;
            });
        });
}

function fillQueryString(qs) {
    return _dataAdapter.get('reporter-url')
        .then(function(reporterUrl) {
            if(!qs.testRunnerSession) {
                qs.testRunnerSession = +(new Date());
            }

            if(!qs.testIndex) {
                qs.testIndex = 0;
            }
            qs.reporterUrl = reporterUrl + '?testRunnerSession=' + qs.testRunnerSession + '&testIndex=' + qs.testIndex;
        });
}

function addTestRenderers(newTestRenderers) {
    for(var name in newTestRenderers) {
        _testRenderers[name] = newTestRenderers[name];
    }
}

function addTestSuites(newTestDefinition) {
    config.testSuites = newTestDefinition;
}

var testSuiteRequest = '/tests';

app.get(
    testSuiteRequest,
    function (request, response, next) {
        var qs = queryString.parse(request.url.split('?')[1]);
        var tags = formatTags(qs.tags);
        if(!tags.length) {
            tags = ALL_TAGS;
        }

        fillQueryString(qs)
            .then(function() {
                return getfilteredTests(tags);
            })
            .then(function(filteredTests) {
                if(qs.testIndex >= filteredTests.length) {
                    return renderResponse(
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
                }
                else {
                    return getTestSuitePageElements(filteredTests[qs.testIndex].elements, qs)
                        .then(function(pageElements) {
                            return renderResponse(
                                response,
                                '../templates/template.html',
                                {
                                    pageElements: pageElements,
                                    tags: filteredTests[qs.testIndex].tags,
                                    qs: qs
                                }
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
            })
            .catch(function(error) {
                console.error(error);
            })
    }
);


module.exports = {
    setDataAdapter: setDataAdapter,
    middleware: app,
    addTestRenderers: addTestRenderers
};
