/*
 * Copyright (c) 2013 Soulberto Lorenzo <slorenzot@gmail.com>
 *
 * Licensed under MIT
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
 * brackets-jscompressor - a brackets plugin to run scripts
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, window, exports, require */

define(function (require, exports, module) {
    'use strict';
    var AppInit             = brackets.getModule("utils/AppInit"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        ExtensionLoader     = brackets.getModule("utils/ExtensionLoader"),
        Dialogs             = brackets.getModule("widgets/Dialogs"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        CommandManager      = brackets.getModule("command/CommandManager"),
        PreferencesManager  = brackets.getModule("preferences/PreferencesManager"),
        ProjectManager      = brackets.getModule("project/ProjectManager"),
        StringUtils         = brackets.getModule("utils/StringUtils"),
        Menus               = brackets.getModule("command/Menus"),
        NodeConnection      = brackets.getModule("utils/NodeConnection");
        
    var appMenu             = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU),
        projectMenu         = Menus.getContextMenu(Menus.ContextMenuIds.PROJECT_MENU),
        workingsetMenu      = Menus.getContextMenu(Menus.ContextMenuIds.WORKING_SET_MENU),
        nodeConnection      = null;
        
    var Commands    = require('Commands'),
        Languages   = require('Strings'),
        Shortcuts   = require('Shortcuts'),
        Utils       = require('Utils');
    
    var userLanguage = brackets.app.language,
        langs = Languages.Strings(userLanguage);
    
    var settings    = PreferencesManager.getPreferenceStorage(Commands.EXTENSION_ID);
        
    console.log(StringUtils.format(langs.DBG_LANGUAGE_DETECTED, Commands.EXTENSION_ID, userLanguage));
    
    console.log(module.uri);
    
    var jscompressor = {
        name: 'Brackets JSCompressor',
        extensions: [ // allowed extension file
            "js",
            "css"
        ],
        compressed_extension: "-min.",
        compressor_relpath: 'compressor/yuicompressor-2.4.2.jar',
        getCompressorPath: function () {
            return StringUtils.format("{0}/{1}", Utils.getExtensionPath(), this.compressor_relpath);
        },
        checkJREInstall: function () {
            var jreInstalled = jscompressor.isJREInstalled();
            
            if (!jreInstalled) {
                var dialog = Dialogs.showModalDialog(
                    Dialogs.DIALOG_ID_ERROR,
                    StringUtils.format(langs.DLG_JRE_NOT_FOUND_TITLE, Commands.EXTENSION_ID),
                    StringUtils.format(langs.DLG_JRE_NOT_FOUND_MSG, 'href=\"http://www.java.com/es/download/')
                );
            }
            
            return jreInstalled;
        },
        isJREInstalled: function () {
//            var node = new NodeConnection(),
//                connection = node.connect(true);
//            
//            node.domains.nodeexec.runScript("which java", null, {
//                cwd: getExtensionPath()
//            });
//            
//            $(node)
//                .on("nodeexec.update", function (domain, response) {
//                    var command = JSON.parse(response); // parsing json from node js
//                    
//                    console.log(command);
//                });
            return true;
        },
        compressfile: function () {
            var selectedItem = ProjectManager.getSelectedItem();
            
            if (selectedItem === null) {
                selectedItem = DocumentManager.getCurrentDocument().file;
            }
            
            if (!jscompressor.checkJREInstall()
                    || !selectedItem.isFile
                        || (/([\w\.]+)(\-min)\.(js|css)$/.test(selectedItem.name)
                            || !/(\.(js|css))$/.test(selectedItem.name))) {
                return; // Do nothing because JRE is not installed
            }
            
            var compressor_path = jscompressor.getCompressorPath(), // get path to compressor
                src = selectedItem.fullPath,
                filename = src.substring(0, src.lastIndexOf('.')), // full filename without extension
                new_ext = jscompressor.compressed_extension + src.split('.').pop(), // only new extension file
                dst = filename + new_ext; // compressed filepath (path + filename + new extension)
            
            var command = StringUtils.format('java -jar "{0}" -o "{1}" "{2}"', compressor_path, dst, src);
            
            nodeConnection.domains.nodeexec.runScript(command, null, {
                cwd: Utils.getExtensionPath()
            });
        }
    };
    
    /**
     * Register commands
     */
    var autocompress_cmd, compressfile_cmd;
    
    // Regiter autocompress command
    autocompress_cmd = CommandManager.register(
        langs.CMD_ACTIVE_COMPRESS_ON_SAVE,
        Commands.CMD_ACTIVE_COMPRESS_ON_SAVE,
        function () {
            var autocompress_isActive = settings.getValue(Commands.SET_AUTOCOMPRESS_ON_SAVE_ENABLED),
                command = CommandManager.get(Commands.CMD_ACTIVE_COMPRESS_ON_SAVE);
            
            settings.setValue(Commands.SET_AUTOCOMPRESS_ON_SAVE_ENABLED, !autocompress_isActive);
            PreferencesManager.savePreferences();

            command.setChecked(!autocompress_isActive);
        }
    );
    
    // Register compress file command
    compressfile_cmd = CommandManager.register(
        langs.CMD_COMPRESS_NOW,
        Commands.CMD_COMPRESS_NOW,
        jscompressor.compressfile
    );
    
    // active settings saved previous brackets runnings
    autocompress_cmd.setChecked(settings.getValue(Commands.SET_AUTOCOMPRESS_ON_SAVE_ENABLED)); // enable autocompress
    
    if (appMenu) {
//        appMenu.addMenuDivider();
        appMenu.addMenuItem(
            Commands.CMD_ACTIVE_COMPRESS_ON_SAVE,
            Shortcuts.allPlatforms.CMD_ACTIVE_COMPRESS_ON_SAVE,
            appMenu.LAST_IN_SECTION
        );
    }
    
    // after save document action
    $(DocumentManager).on("documentSaved", function (evt, entry) {
        var autocompress_isActive = settings.getValue(Commands.SET_AUTOCOMPRESS_ON_SAVE_ENABLED);
        
        if (jscompressor.isJREInstalled() && autocompress_isActive) {
            jscompressor.compressfile();
        }
    });

    // before create context menu in left tree file viewer
    $(projectMenu).on("beforeContextMenuOpen", function (event) {
        var selectedItem = ProjectManager.getSelectedItem();
        
        projectMenu.removeMenuItem(Commands.CMD_COMPRESS_NOW);
        
        if (selectedItem.isFile
                && (!/([\w\.]+)(\-min)\.(js|css)$/.test(selectedItem.name)
                    && /(\.(js|css))$/.test(selectedItem.name))) {
            if (projectMenu) {
                projectMenu.addMenuItem(Commands.CMD_COMPRESS_NOW, Shortcuts.allPlatforms.CMD_COMPRESS_NOW);
            }
//            compressfile_cmd.setEnabled(true);
        }
    });
    
    function chain() {
        var functions = Array.prototype.slice.call(arguments, 0);
        
        if (functions.length > 0) {
            var currentFunction = functions.shift(),
                callee = currentFunction.call();

            callee.done(function () {
                chain.apply(null, functions);
            });
        }
    }
    
    // extension main function
    AppInit.appReady(function () {
        nodeConnection = new NodeConnection(); // connect NodeJS
        
        if (!jscompressor.checkJREInstall()) {
            return;
        }
        
        // connect to Node
        function connectNode() {
            var node = nodeConnection.connect(true);
            
            console.info(StringUtils.format(langs.DBG_CONNECTING_TO_NODE, Commands.EXTENSION_ID));
            
            node
                .fail(function () {
                    console.error(StringUtils.format(langs.DBG_CONNECTING_TO_NODE_FAIL, Commands.EXTENSION_ID));
                })
                .done(function () {
                    console.info(StringUtils.format(langs.DBG_CONNECTION_TO_NODE_SUCCESS, Commands.EXTENSION_ID));
                });
            
            return node;
        }
        
        // load NodeJS module
        function loadNodeModule() {
            var nodeModule = ExtensionUtils.getModulePath(module, 'node/NodeExecDomain');
            var nodeDomains = nodeConnection.loadDomains([nodeModule], true);
            
            nodeDomains
                .fail(function () {
                    console.log(StringUtils.format(langs.DBG_TO_LOAD_NODEEXEC_DOMAIN_ERROR, Commands.EXTENSION_ID, nodeModule));
                })
                .done(function () {
                    console.info(StringUtils.format(langs.DBG_TO_LOAD_NODEEXEC_DOMAIN_SUCCESS, Commands.EXTENSION_ID, nodeModule));
                });
            
            return nodeDomains;
        }
        
        // update status (working) function
        $(nodeConnection)
            .on("nodeexec.update", function (domain, response) {
                var command = JSON.parse(response); // parsing json from node js
            
                if (command.stderr || command.stdout) { // if compressing process fail
                    console.error(StringUtils.format(langs.DBG_GENERIC_ERROR, Commands.EXTENSION_ID, command.stderr || command.stdout));
                    
                    var dialog = Dialogs.showModalDialog(
                        Dialogs.DIALOG_ID_ERROR,
                        StringUtils.format(langs.DLG_ERROR_BUILDING_TITLE, jscompressor.name),
                        StringUtils.format(langs.DLG_ERROR_BUILDING_MSG, command.stderr || command.stdout)
                    );
                } else {
                    console.info(StringUtils.format(langs.DBG_BUILD_SUCCESSFUL, Commands.EXTENSION_ID));
                }
                
                ProjectManager.refreshFileTree(); // refresh file tree to see new file
            });
        
        // load in chain
        chain(connectNode, loadNodeModule);
        
        jscompressor.isJREInstalled();
    });
});