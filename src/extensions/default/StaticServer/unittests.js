/*
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */


/*jslint vars: true, plusplus: true, devel: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, describe, it, expect, beforeEach, afterEach, waits, waitsFor, waitsForDone, runs, $, brackets, waitsForDone, spyOn, tinycolor, KeyEvent */

define(function (require, exports, module) {
    "use strict";
    
    var StaticServer    = require("main"),
        NodeConnection  = brackets.getModule("utils/NodeConnection"),
        FileUtils       = brackets.getModule("file/FileUtils"),
        SpecRunnerUtils = brackets.getModule("spec/SpecRunnerUtils");
    
    var testFolder     = FileUtils.getNativeModuleDirectoryPath(module) + "/unittest-files/";
    
    var CONNECT_TIMEOUT = 5000;
    
    var LOCALHOST_PORT_PARSER_RE = /http:\/\/127\.0\.0\.1:(\d+)\//;
            
    function makeBaseUrl(serverInfo) {
        return "http://" + serverInfo.address + ":" + serverInfo.port;
    }
    
    function getUrl(serverInfo, path) {
        return $.get(makeBaseUrl(serverInfo) + path);
    }
    
    describe("StaticServer", function () {
        
        // Unit tests for the underlying node server.
        describe("StaticServerDomain", function () {
            var nodeConnection;
            
            beforeEach(function () {
                runs(function () {
                    nodeConnection = new NodeConnection();
                    waitsForDone(nodeConnection.connect(false), "connecting to node server", CONNECT_TIMEOUT);
                });
                
                runs(function () {
                    var domainPromise = new $.Deferred(),
                        retries = 0;

                    function waitForDomain() {
                        if (nodeConnection.domains.staticServer) {
                            domainPromise.resolve();
                        } else {
                            retries++;
                            if (retries >= 5) {
                                domainPromise.reject();
                            } else {
                                setTimeout(waitForDomain, 100);
                            }
                        }
                    }
                    
                    waitForDomain();
                    waitsForDone(domainPromise, "waiting for StaticServer domain to load");
                });
            });
            
            afterEach(function () {
                nodeConnection.disconnect();
                nodeConnection = null;
            });
            
            it("should start a static server on the given folder", function () {
                var serverInfo, path = testFolder + "folder1";
                runs(function () {
                    nodeConnection.domains.staticServer.getServer(path)
                        .done(function (info) {
                            serverInfo = info;
                        });
                });
                
                waitsFor(function () { return serverInfo; }, "waiting for static server to start");
                
                runs(function () {
                    expect(serverInfo.address).toBe("127.0.0.1");
                    expect(Number(serverInfo.port)).toBeGreaterThan(0);
                    
                    waitsForDone(nodeConnection.domains.staticServer.closeServer(path),
                                 "waiting for static server to close");
                });
            });
            
            it("should serve the text of a file in the given folder", function () {
                var serverInfo, text, path = testFolder + "folder1";
                runs(function () {
                    nodeConnection.domains.staticServer.getServer(path)
                        .done(function (info) {
                            serverInfo = info;
                        });
                });
                
                waitsFor(function () { return serverInfo; }, "waiting for static server to start");
                
                runs(function () {
                    getUrl(serverInfo, "/index.txt").done(function (data) {
                        text = data;
                    });
                });
                
                waitsFor(function () { return text; }, "waiting for text from server");
                
                runs(function () {
                    expect(text).toBe("This is a file in folder 1.");
                    
                    waitsForDone(nodeConnection.domains.staticServer.closeServer(path),
                                 "waiting for static server to close");
                });
            });
            
            it("should create separate servers for different folders", function () {
                var serverInfo1, serverInfo2,
                    path1 = testFolder + "folder1", path2 = testFolder + "folder2";
                runs(function () {
                    nodeConnection.domains.staticServer.getServer(path1)
                        .done(function (info) {
                            serverInfo1 = info;
                        });
                    nodeConnection.domains.staticServer.getServer(path2)
                        .done(function (info) {
                            serverInfo2 = info;
                        });
                });
                
                waitsFor(function () { return serverInfo1 && serverInfo2; }, "waiting for static servers to start");
                
                runs(function () {
                    expect(serverInfo1.port).not.toBe(serverInfo2.port);
                    
                    waitsForDone(nodeConnection.domains.staticServer.closeServer(path1),
                                 "waiting for static server 1 to close");
                    waitsForDone(nodeConnection.domains.staticServer.closeServer(path2),
                                 "waiting for static server 2 to close");
                });
            });
            
            it("should keep a previous server alive after creating a new server", function () {
                var serverInfo1, serverInfo2,
                    path1 = testFolder + "folder1", path2 = testFolder + "folder2",
                    text1, text2;
                runs(function () {
                    nodeConnection.domains.staticServer.getServer(path1)
                        .done(function (info) {
                            serverInfo1 = info;
                        });
                    nodeConnection.domains.staticServer.getServer(path2)
                        .done(function (info) {
                            serverInfo2 = info;
                        });
                });
                
                waitsFor(function () { return serverInfo1 && serverInfo2; }, "waiting for static servers to start");
                
                runs(function () {
                    getUrl(serverInfo1, "/index.txt").done(function (data) {
                        text1 = data;
                    });
                    getUrl(serverInfo2, "/index.txt").done(function (data) {
                        text2 = data;
                    });
                });
                
                waitsFor(function () { return text1 && text2; }, "waiting for text from servers");
                
                runs(function () {
                    expect(text1).toBe("This is a file in folder 1.");
                    expect(text2).toBe("This is a file in folder 2.");
                    
                    waitsForDone(nodeConnection.domains.staticServer.closeServer(path1),
                                 "waiting for static server 1 to close");
                    waitsForDone(nodeConnection.domains.staticServer.closeServer(path2),
                                 "waiting for static server 2 to close");
                });
            });
            
            it("should trigger an event when a file path is requested", function () {
                var serverInfo,
                    path = testFolder + "folder1",
                    text,
                    location,
                    self = this,
                    elapsed,
                    timeout = 500;
                
                runs(function () {
                    nodeConnection.domains.staticServer.getServer(path)
                        .done(function (info) {
                            serverInfo = info;
                        });
                });
                
                waitsFor(function () { return serverInfo; }, "waiting for static server to start");
                
                runs(function () {
                    // listen for request event
                    var provider = StaticServer._getStaticServerProvider();
                    $(provider).on("request.test", function (event, request) {
                        location = request.location;

                        // Do not call request.send() in order to hit timeout
                    });
                    
                    // listen for /index.txt requests
                    waitsForDone(nodeConnection.domains.staticServer.setRequestFilterPaths(path, ["/index.txt"]));

                    // set a custom timeout
                    waitsForDone(nodeConnection.domains.staticServer._setRequestFilterTimeout(timeout));

                    // remove event handler and timeout
                    self.after(function() { $(provider).off(".test"); });
                });

                runs(function () {
                    // it should take longer than the StaticServerDomain timeout to get a response
                    elapsed = new Date();

                    // request /index.txt
                    getUrl(serverInfo, "/index.txt").done(function (data) {
                        elapsed = new Date() - elapsed;
                        text = data;
                    });
                });
                
                waitsFor(function () { return location && text; }, "waiting for request event to fire");

                runs(function () {
                    expect(location.pathname).toBe("/index.txt");
                    expect(text).toBe("This is a file in folder 1.");

                    // we should hit the timeout since we filtered this path and did not respond
                    expect(elapsed).toBeGreaterThan(timeout);
                    
                    waitsForDone(nodeConnection.domains.staticServer.closeServer(path),
                                 "waiting for static server to close");

                    waitsForDone(nodeConnection.domains.staticServer._setRequestFilterTimeout(-1), "restore request filter timeout");
                });
            });
            
            it("should send static file contents after canceling a filter request", function () {
                var serverInfo,
                    path = testFolder + "folder1",
                    text,
                    location,
                    self = this;
                
                runs(function () {
                    nodeConnection.domains.staticServer.getServer(path)
                        .done(function (info) {
                            serverInfo = info;
                        });
                });
                
                waitsFor(function () { return serverInfo; }, "waiting for static server to start");
                
                runs(function () {
                    // listen for request event
                    var provider = StaticServer._getStaticServerProvider();
                    $(provider).on("request.test", function (event, request) {
                        location = request.location;
                        request.send(); /* do not rewrite the content */

                        // a second call to send does nothing
                        request.send({body: "custom response"});
                    });

                    // remove event handler
                    self.after(function() { $(provider).off(".test"); });

                    
                    // listen for /index.txt requests
                    waitsForDone(nodeConnection.domains.staticServer.setRequestFilterPaths(path, ["/index.txt"]));
                });

                runs(function () {
                    // request /index.txt
                    getUrl(serverInfo, "/index.txt").done(function (data) {
                        text = data;
                    });
                });
                
                waitsFor(function () { return location && text; }, "waiting for request event to fire");

                runs(function () {
                    expect(location.pathname).toBe("/index.txt");
                    expect(text).toBe("This is a file in folder 1.");
                    
                    waitsForDone(nodeConnection.domains.staticServer.closeServer(path),
                                 "waiting for static server to close");
                });
            });
            
            it("should override the static file server response with a new response body", function () {
                var serverInfo,
                    path = testFolder + "folder1",
                    text,
                    location,
                    self = this;
                
                runs(function () {
                    nodeConnection.domains.staticServer.getServer(path)
                        .done(function (info) {
                            serverInfo = info;
                        });
                });
                
                waitsFor(function () { return serverInfo; }, "waiting for static server to start");
                
                runs(function () {
                    // listen for request event
                    var provider = StaticServer._getStaticServerProvider();
                    $(provider).on("request.test", function (event, request) {
                        location = request.location;

                        // write custom response
                        request.send({body: "custom response"});
                    });

                    // remove event handler
                    self.after(function() { $(provider).off(".test"); });
                    
                    // listen for /index.txt requests
                    waitsForDone(nodeConnection.domains.staticServer.setRequestFilterPaths(path, ["/index.txt"]));
                });

                runs(function () {
                    // request /index.txt
                    getUrl(serverInfo, "/index.txt").done(function (data) {
                        text = data;
                    });
                });
                
                waitsFor(function () { return location && text; }, "waiting for text from server");

                runs(function () {
                    expect(location.pathname).toBe("/index.txt");
                    expect(text).toBe("custom response");
                    
                    waitsForDone(nodeConnection.domains.staticServer.closeServer(path),
                                 "waiting for static server to close");
                });
            });
        });
        
        // Unit tests for the StaticServerProvider that wraps the underlying node server.
        describe("StaticServerProvider", function () {
            var brackets,
                ProjectManager,
                StaticServer;
            
            beforeEach(function () {
                runs(function () {
                    SpecRunnerUtils.createTestWindowAndRun(this, function (testWindow) {
                        // Load module instances from brackets.test
                        brackets = testWindow.brackets;
                        ProjectManager = testWindow.brackets.test.ProjectManager;
                    });
                });
                
                waitsFor(function () {
                    return brackets.test.extensions.StaticServer !== undefined;
                }, "StaticServer to fully initialize");
                
                runs(function () {
                    StaticServer = brackets.test.extensions.StaticServer;
                    waitsForDone(StaticServer._getNodeConnectionDeferred(), "connecting to node server", CONNECT_TIMEOUT);
                });
            });

            afterEach(function () {
                SpecRunnerUtils.closeTestWindow();
            });
            
            
            it("should have initialized the static server provider immediately after launch", function () {
                // Note: the goal is to test this as quickly as possible. We can't
                // actually test immediately when appReady fires because that happens
                // asynchronously in our test window. But we know this will run shortly
                // after appReady fires. There's no way to test it synchronously
                // because appReady is the event that gives us access to StaticServer in
                // the test window.
                expect(StaticServer._getStaticServerProvider()).toBeTruthy();
            });
            
            
            it("should only serve html files that are in the project file hierarchy", function () {
                waitsForDone(ProjectManager.openProject(testFolder), "opens test folder in ProjectManager");
                
                runs(function () {
                    var provider = StaticServer._getStaticServerProvider();

                    // should not serve files outside project hierarchy
                    expect(provider.canServe("/foo.html")).toBe(false);
                    
                    // should not serve non-HTML files inside hierarchy
                    expect(provider.canServe(testFolder + "foo.jpg")).toBe(false);

                    // should serve .htm files inside hierarchy
                    expect(provider.canServe(testFolder + "foo.htm")).toBe(true);

                    // should serve .html files inside hierarchy
                    expect(provider.canServe(testFolder + "foo.html")).toBe(true);

                    // should serve .HTML files inside hierarchy
                    expect(provider.canServe(testFolder + "foo.HTML")).toBe(true);

                    // should serve root of hierarchy
                    expect(provider.canServe(testFolder)).toBe(true);
                    
                });
                
            });

            it("should be ready to serve a file in the project and return an appropriate baseUrl", function () {
                waitsForDone(ProjectManager.openProject(testFolder), "opens test folder in ProjectManager");
                
                waitsForDone(StaticServer._getStaticServerProvider().readyToServe(), "being ready to serve");
                    
                runs(function () {
                    var baseUrl = StaticServer._getStaticServerProvider().getBaseUrl();
                    var parsedUrl = LOCALHOST_PORT_PARSER_RE.exec(baseUrl);
                    expect(parsedUrl).toBeTruthy();
                    expect(parsedUrl.length).toBe(2);
                    expect(Number(parsedUrl[1])).toBeGreaterThan(0);
                });
            });
            
            it("should decline serving if not connected to node", function () {
                var nodeConnectionDeferred;
                runs(function () {
                    nodeConnectionDeferred = StaticServer._getNodeConnectionDeferred();
                    waitsForDone(nodeConnectionDeferred, "connecting to node server", CONNECT_TIMEOUT);
                });

                runs(function () {
                    nodeConnectionDeferred.done(function (nodeConnection) {
                        // this will be run synchronously because of the waitsFor above
                        nodeConnection.disconnect();
                    });
                    expect(StaticServer._getStaticServerProvider().canServe(testFolder + "foo.html")).toBe(false);
                });
                
            });
            
        });
    });
});
