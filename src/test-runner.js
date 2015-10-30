var fs = require('fs');
var path = require('path');

var RSVP = require('rsvp');
var queryString = require('querystring');
var shallowExtend = require('shallow-extend');


var ALL_TAGS = '#all#';

var _testRenderers = {};
var _dataAdapter = null;


module.exports = {
    GETTests: function GETTests(url) {
        var qs;
        var tags;

        return RSVP.Promise.resolve()
            .then(function() {
                qs = queryString.parse(url.split('?')[1]);
                tags = this._formatTags(qs.tags);
                if(!tags.length) {
                    tags = ALL_TAGS;
                }
                return this._fillQueryString(qs);
            }.bind(this))
            .then(function() {
                return this._getfilteredTests(tags);
            }.bind(this))
            .then(function(filteredTests) {
                if(qs.testIndex >= filteredTests.length) {
                    return {
                        templateName: 'done.html',
                        templateData: qs
                    };
                }
                else {
                    return this._getTestSuitePageElements(filteredTests[qs.testIndex].elements, qs)
                        .then(function(pageElements) {
                            return {
                                templateName: 'template.html',
                                templateData: {
                                    pageElements: pageElements,
                                    tags: filteredTests[qs.testIndex].tags,
                                    qs: qs
                                }
                            };
                        }.bind(this));
                }
            }.bind(this));
    },

    setDataAdapter: function setDataAdapter(dataAdapter) {
        _dataAdapter = dataAdapter;
    },

    addTestRenderers: function addTestRenderers(newTestRenderers) {
        for(var name in newTestRenderers) {
            _testRenderers[name] = newTestRenderers[name];
        }
    },

    addTestSuites: function addTestSuites(newTestDefinition) {
        config.testSuites = newTestDefinition;
    },

    _rawContentToTag: function _rawContentToTag(rawContent) {
        if(/\.css$/.test(rawContent)) {
            return '<link rel="stylesheet" type="text/css" href="' + rawContent+ '"/>';
        }
        else if(/\.js$/.test(rawContent)) {
            return '<script type="text/javascript" src="' + rawContent + '"></script>';
        }
    },

    _getPageElement: function _getPageElement(pageElementName, params) {
        if(pageElementName in _testRenderers) {
            return _testRenderers[pageElementName].render(params);
        }
        return new RSVP.Promise(function(resolve, reject) {
            if(!params.rawContent) {
                reject(new Error('missing content in ' + pageElementName));
                return;
            }
            resolve(this._rawContentToTag(params.rawContent));
        }.bind(this));
    },

    _formatPageElementData: function _formatPageElementData(pageElementData) {
        var result = {};
        var elementName;
        
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
    },

    _getTestSuitePageElements: function _getTestSuitePageElements(pageElements, qs) {
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
                        pageElementData = this._formatPageElementData(pageElementData);
                        var params = shallowExtend({}, pageElementData.params, qs);
                        return this._getPageElement(pageElementData.name, params);
                    }.bind(this))
                );
            }.bind(this));
    },

    _formatTags: function _formatTags(tagString) {
        if(typeof(tagString) !== 'string') {
            return [];
        }
        return tagString
            .split(',')
            .map(function(tag) {return tag.trim().toLowerCase();});
    },

    _matchTags: function _matchTags(candidates, reference) {
        if(candidates === ALL_TAGS) {
            return true;
        }
        return candidates.every(function(candidate) {
            return reference.indexOf(candidate) !== -1;
        });
    },

    _getfilteredTests: function _getfilteredTests(tags) {
        return _dataAdapter.get('tests/library')
            .then(function(testLibrary) {
                return testLibrary.filter(function(test) {
                    for(var testTags in test) {
                        if(tags === ALL_TAGS || this._matchTags(tags, this._formatTags(testTags))) {
                            return true;
                        }
                    }
                }.bind(this))
                .map(function(test) {
                    var transformedTest;
                    for(var testTags in test) {
                        transformedTest = {
                            tags: testTags,
                            elements: test[testTags]
                        };
                    }
                    return transformedTest;
                }.bind(this));
            }.bind(this));
    },

    _fillQueryString: function _fillQueryString(qs) {
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
};
