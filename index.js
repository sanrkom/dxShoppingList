var TABLE = 'MyShoppingList';

var CloudDAL = function () {
	
    this.saveItem = function (table, item) {
        var result = $.Deferred();
        DXCloud.Entity.save({
            tableName: table,
            entity: item,
            success: function (entity, params) {
                result.resolve(entity, params);
            },
            error: function (err) {
                result.reject(err);
            }
        });
        return result.promise();
    };

    this.removeItem = function (table, item) {
        var result = $.Deferred();
        DXCloud.Entity.destroy({
            tableName: table,
            entity: item,
            success: function (params) {
                result.resolve(params);
            },
            error: function (err) {
                result.reject(err);
            }
        });
        return result.promise();
    };

    this.loadItems = function (table) {
        var result = $.Deferred();
        DXCloud.Entity.load({
            tableName: table,
            success: function (entities, params) {
                result.resolve(entities, params);
            },
            error: function (err) {
                result.reject(err);
            }
        });
        return result.promise();
    };
}

//Knockout ViewModel
var ViewModel = function () {
    var self = this;

    var cloudDAL = new CloudDAL();

    self.newItem = ko.observable();

    self.items = ko.observableArray();


    cloudDAL.loadItems(TABLE).done(function (entities, params) {
        self.items(entities);
	});

    self.refreshItems = function () {
        self.items(self.items());
    };

    self.removeItem = function () {
        var item = this;
        self.items.remove(item);
        cloudDAL.removeItem(TABLE, item);
    };

    self.checkItem = function () {
        var item = this;
        cloudDAL.saveItem(TABLE, item);
        self.refreshItems();
        return true;
    };

    var Item = function (text) {
        return { text: text, hasBuyed: false };
    }

    self.createItem = function (model, e) {
        if (e.keyCode == 13) {
            e.currentTarget.blur();
            var newItemText = this.newItem();            
            e.currentTarget.focus();
            var item = new Item(newItemText);
            self.newItem('');
            cloudDAL.saveItem(TABLE, item).done(function(item){            	
            	self.items.push(item);
            });
        }
        else {
            return true;
        }
    };


    self.items.subscribe(function (newValue) {
        newValue.sort(function (a, b) {
            return a.hasBuyed;
        });
    });

};
