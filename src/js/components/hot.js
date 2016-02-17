(function () {
    var _ = require('lodash');
    var h = require('virtual-dom/h');
    var hot;
    function constructor(services) {
        var that = {};
        var element;
        var readOnly;
        that.load = function (_element_) {
            element = _element_;
            readOnly = services.data.getUrl() ? true : false;
            hot = new Handsontable(element, {
                startRows: 8,
                startCols: 5,
                height: 500,
                stretchH: 'all',
                rowHeaders: true,
                colHeaders: true,
                contextMenu: true,
                afterChange: function () {
                    var data = removeEmptyRows(this);
                    if (!_.isEmpty(data)) {
                        services.data.set(removeEmptyRows(hot));
                    }
                }
            });


            hot.updateSettings({
                cells: function (row, col, prop) {
                    var cellProperties = {};
                    cellProperties.readOnly = readOnly;
                    return cellProperties;
                }
            });
            var data = services.data.get();
            if (!_.isEmpty(data)) {
                hot.updateSettings({
                    data: data
                });
            }
            services.mediator.on('dataUpdate', function (_data_) {
                readOnly = services.data.getUrl() ? true : false;
                if(_data_.length > 0){
                    hot.updateSettings({
                        data: _data_,
                        cells: function (row, col, prop) {
                            var cellProperties = {};
                            cellProperties.readOnly = readOnly;
                            return cellProperties;
                        }
                    });
                } else {
                    hot.clear();
                }

            }, 'hot');
        };

        var Hook = function () {};
        Hook.prototype.hook = function (node) {
            setTimeout(function () {
                that.load(node);
            });
        };

        that.template = function () {
            return h('div', {
                'afterRender': new Hook()
            });
        };

        that.destroy = function () {
            services.mediator.off(null, null, 'hot');
            var data = removeEmptyRows(hot);
            if (!_.isEmpty(data)) {
                services.data.set(removeEmptyRows(hot));
            }
            hot.destroy();
        };

        function removeEmptyRows(hot) {
            var gridData = hot.getData();
            var cleanedGridData = [];
            _.forEach(gridData, function (object, rowKey) {
                if (!hot.isEmptyRow(rowKey)) cleanedGridData[rowKey] = object;
            });
            return cleanedGridData;
        }

        return that;
    }

    module.exports = constructor;
})();