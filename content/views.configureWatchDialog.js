var ConfigureWatchDialog = Backbone.View.extend({
    tagName: "div",
    className: "modal",

    events: {
        "shown.bs.modal": "onBootstrapModalShown",
        "hidden.bs.modal": "onBootstrapModalHidden",
        "click .btn-add-variable": "onClickAddVariable",
        "click .btn-submit": "onClickSubmit"
    },

    initialize: function (options) {
        this.onTestnet = options.onTestnet;
        this.listenTo(this.model, "change", this.onModelChange);
        this.render();
    },

    onModelChange: function () {
        this.render();
    },

    render: function () {
        var template = app.underscoreTemplates["TemplateConfigureWatchDialog"];
        var contract = this.model.toJSON();
        var html = template({ contract: contract, onTestnet: this.onTestnet });
        this.$el.html(html);

        if (!$.contains(document, this.el)) {
            this.$el.appendTo("body");
            this.$el.modal({ show: false });
        }

        return this;
    },

    show: function () {
        this.$el.modal("show");
    },

    close: function () {
        this.$el.modal("hide");
    },

    onBootstrapModalShown: function () {
    },

    onBootstrapModalHidden: function () {
        this.$el.data('modal', null);
        this.remove();
    },

    onClickAddVariable: function () {
        this.model.addWatchedVariable({
            onTestnet: this.onTestnet
        });
    },

    onClickSubmit: function () {

    }
});