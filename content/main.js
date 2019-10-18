var app = {};
app.events = _.extend({}, Backbone.Events);

$(function () {
    main();
});

function main() {
    app.vscode = acquireVsCodeApi();
    app.smartContracts = new SmartContractsCollection();
    initializeUnderscoreTemplates();
    listenToExtensionMessages();

    // Listen to vscode extension messages.
    window.addEventListener("message", event => {
        app.log("INCOMING MESSAGE: " + event.data.what);
        app.log(event.data.payload);
        app.events.trigger(`extension-message:${event.data.what}`, event.data.payload || {});
    });

    app.manageDebugServerView = new ManageDebugServerView({
        el: ".manage-debug-server-view"
    });

    app.configurationView = new ConfigurationView({
        el: ".configuration-view"
    });

    app.smartContractsListView = new SmartContractsListView({
        el: ".smart-contracts-list-view",
        collection: app.smartContracts
    });
}

function initializeUnderscoreTemplates() {
    app.underscoreTemplates = {};

    $("script[type='text/template']").each(function () {
        var $this = $(this);
        var key = $this.attr("id");
        var htmlTemplate = $this.html();
        var compiledTemplate = _.template(htmlTemplate);

        app.underscoreTemplates[key] = compiledTemplate;
    });
}

function listenToExtensionMessages() {
    // Builder
    app.events.on("extension-message:builder:started", function (payload) {
        $("#BuilderStdout .payload").append($("<div class='text-warning'>").text(payload.program));
        $("#BuilderStdout .payload").append($("<div class='text-warning'>").text(JSON.stringify(payload.args)));
    });

    app.events.on("extension-message:builder:output", function (payload) {
        $("#BuilderStdout .payload").append($("<div>").text(payload));
    });

    app.events.on("extension-message:builder:error", function (payload) {
        $("#BuilderStdout .payload").append($("<div class='text-danger'>").text(payload));
    });

    // Debugger
    app.events.on("extension-message:debugger:output", function (payload) {
        $("#DebuggerStdout .payload").append($("<div>").text(payload));
    });

    app.events.on("extension-message:debugger:error", function (payload) {
        $("#DebuggerStdout .payload").append($("<div class='text-danger'>").text(payload));
    });

    // Debugger dialogue
    app.events.on("extension-message:debugger-dialogue:request", function (payload) {
        $("#RestDialogue .payload").append($("<div>").text(payload.url));
        $("#RestDialogue .payload").append($("<div>").text(JSON.stringify(payload.data, null, 4)));
    });

    app.events.on("extension-message:debugger-dialogue:response", function (payload) {
        $("#RestDialogue .payload").append($("<div>").text(payload.url));
        $("#RestDialogue .payload").append($("<div>").text(JSON.stringify(payload.data, null, 4)));
    });

    // Others
    app.events.on("extension-message:refreshSmartContracts", function (payload) {
        onMessageRefreshSmartContracts(payload);
    });
}

function onMessageRefreshSmartContracts(contracts) {
    app.smartContracts.reset(contracts);
}

var SmartContract = Backbone.Model.extend({
    initialize: function () {
    }
});

var SmartContractsCollection = Backbone.Collection.extend({
    model: SmartContract
});

var SmartContractsListView = Backbone.View.extend({
    tagName: "div",

    events: {
        "click .btn-refresh-smart-contracts": "onClickRefreshSmartContracts"
    },

    initialize: function () {
        this.childViews = [];
        this.listenTo(this.collection, "reset", this.render);
        this.render();
    },

    render: function () {
        this.removeChildViews();
        this.createChildViews();
        return this;
    },

    removeChildViews: function () {
        _.each(this.childViews, function (childView) {
            childView.remove();
        });

        this.childViews = [];
    },

    createChildViews: function () {
        this.collection.each(this.createChildView, this);
    },

    createChildView: function (contract) {
        var childView = new SmartContractPanelView({ model: contract });
        childView.render();
        this.$el.append(childView.$el);
        this.childViews.push(childView);
    },

    onClickRefreshSmartContracts: function () {
        app.talkToVscode("refreshSmartContracts");
    }
});

var SmartContractPanelView = Backbone.View.extend({
    tagName: "div",

    events: {
        "click .btn-build-contract": "onClickBuild",
        "click .btn-deploy-contract": "onClickDeploy",
        "click .btn-run-contract": "onClickRun",
    },

    initialize: function () {
        this.listenTo(this.model, "change", this.onModelChange);
    },

    onModelChange: function () {
        this.render();
    },

    render: function () {
        var template = app.underscoreTemplates["TemplateSmartContractPanel"];
        var contract = this.model.toJSON();
        var html = template({ contract: contract });
        this.$el.html(html);
        this.renderVMOutput();

        return this;
    },

    renderVMOutput: function() {
        if (this.VMOutputView) {
            this.VMOutputView.remove();
        }

        this.VMOutputView = new VMOutputView({ 
            el: this.$el.find(".vm-output-view"),
            model: this.model.get("LatestRun")
        });

        this.VMOutputView.render();
    },

    onClickBuild: function () {
        app.talkToVscode("buildSmartContract", { id: this.model.get("FriendlyId") });
    },

    onClickDeploy: function () {
        var senderAddress = app.configurationView.getSenderAddress();

        app.talkToVscode("deploySmartContract", {
            id: this.model.get("FriendlyId"),
            senderAddress: senderAddress
        });
    },

    onClickRun: function () {
        var senderAddress = app.configurationView.getSenderAddress();
        var functionName = this.getFunctionName();
        var functionArgs = this.getFunctionArgs();
        var value = this.getRunValue();
        var maximumGas = this.getMaximumGas();
        var gasPrice = this.getGasPrice();

        app.talkToVscode("runSmartContract", {
            id: this.model.get("FriendlyId"),
            senderAddress: senderAddress,
            functionName: functionName,
            functionArgs: functionArgs,
            value: value,
            maximumGas: maximumGas,
            gasPrice: gasPrice
        });
    },

    getFunctionName: function() {
        return this.$el.find("[name='FunctionName']").val();
    },

    getFunctionArgs: function() {
        var argsString = this.$el.find("[name='FunctionArgs']").val();
        var args = argsString.split("\n");
        return args;
    },

    getRunValue: function() {
        return this.$el.find("[name='Value']").val();
    },

    getMaximumGas: function() {
        return this.$el.find("[name='MaximumGas']").val();
    },

    getGasPrice: function() {
        return this.$el.find("[name='GasPrice']").val();
    }
});

var VMOutputView = Backbone.View.extend({
    tagName: "div",

    initialize: function () {
        this.render();
    },

    render: function () {
        var template = app.underscoreTemplates["TemplateVMOutput"];
        var html = template({ data: this.model.VMOutput || {} });
        this.$el.html(html);
        return this;
    },
});

var ManageDebugServerView = Backbone.View.extend({
    events: {
        "click .btn-start-debug-server": "onClickStartDebugServer",
        "click .btn-stop-debug-server": "onClickStopDebugServer",
    },

    initialize: function () {
    },

    onClickStartDebugServer: function () {
        app.talkToVscode("startDebugServer");
    },

    onClickStopDebugServer: function () {
        app.talkToVscode("stopDebugServer");
    }
});

var ConfigurationView = Backbone.View.extend({
    events: {
    },

    initialize: function () {
    },

    getSenderAddress() {
        return this.$el.find("[name='SenderAddress']").val();
    }
});

app.talkToVscode = function (what, payload) {
    app.log("OUTGOING MESSAGE: " + what);
    app.log(payload);
    app.vscode.postMessage({ what: what, payload: payload });
};

app.log = function (message) {
    console.log(message);

    if (typeof message !== "string") {
        message = JSON.stringify(message, null, 4);
    }

    var element = $("<div>").text(message);
    $("#ExtensionConsole .payload").append(element);
};