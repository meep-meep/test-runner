var RSVP = require('rsvp');
var mockery = require('mockery');


var testRunner;

describe('test-runner', function() {
    before(function() {
        mockery.enable({useCleanCache: true});
        mockery.registerAllowable('../src/test-runner');
        mockery.registerAllowable('rsvp');
        mockery.registerMock('fs', {});
        mockery.registerMock('path', {});
        mockery.registerMock('querystring', {});
        mockery.registerMock('shallow-extend', {});
        testRunner = require('../src/test-runner');
    });

    after(function() {
        mockery.deregisterAllowable('../src/test-runner');
        mockery.deregisterAllowable('rsvp');
        mockery.deregisterMock('fs');
        mockery.deregisterMock('path');
        mockery.deregisterMock('querystring');
        mockery.deregisterMock('shallow-extend');
        mockery.disable();
    });

    describe('GETTests', function() {
        before(function() {
            mockery.registerMock('querystring', {parse: function() {return {
                data1: 4,
                data2: 5
            };}});
            mockery.resetCache();
            testRunner = require('../src/test-runner');
        });

        it('should not break', function() {
            testRunner.setDataAdapter({
                get: function(key) {
                    return RSVP.Promise.resolve().then(function() {
                        return [];
                    });
                }
            });
            return testRunner.GETTests('http://my-url.com?data1=4&data2=5');
        });
    });

    describe('setDataAdapter', function() {
        it('should not throw any error', function() {
            testRunner.setDataAdapter({});
        });
    });

    describe('addTestRenderers', function() {
        it('should not throw any error', function() {
            testRunner.addTestRenderers({a:{}, b:{}});
        });
    });
});
