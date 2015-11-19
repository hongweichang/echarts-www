define(function (require) {

    var zrUtil = require('zrender/core/util');
    var symbolCreator = require('../../util/symbol');
    var graphic = require('../../util/graphic');

    var layout = require('../../util/layout');
    var formatUtil = require('../../util/format');

    var LEGEND_DISABLE_COLOR = '#ccc';

    function createSelectActionDispatcher(uid, seriesName, api) {
        api.dispatch({
            type: 'legendToggleSelect',
            from: uid,
            seriesName: seriesName
        });
    }

    function positionGroup(group, legendModel, api) {
        var x = legendModel.get('x');
        var y = legendModel.get('y');
        var x2 = legendModel.get('x2');
        var y2 = legendModel.get('y2');

        if (!x && !x2) {
            x = 'center';
        }
        if (!y && !y2) {
            y = 'top';
        }
        layout.positionGroup(
            group, {
                x: x,
                y: y,
                x2: x2,
                y2: y2
            },
            {
                width: api.getWidth(),
                height: api.getHeight()
            },
            legendModel.get('padding')
        );
    }

    return require('../../echarts').extendComponentView({

        type: 'legend',

        init: function () {
            this._symbolTypeStore = {};
        },

        render: function (legendModel, ecModel, api) {
            var selectMode = legendModel.get('selectedMode');
            var itemWidth = legendModel.get('itemWidth');
            var itemHeight = legendModel.get('itemHeight');
            var itemAlign = legendModel.get('align');

            var group = this.group;
            group.removeAll();

            if (itemAlign === 'auto') {
                itemAlign = group.position[0] / api.getWidth() < 0.7 ? 'left' : 'right';
            }

            var legendDataMap = {};
            zrUtil.each(legendModel.getData(), function (itemModel) {
                var seriesName = itemModel.get('name');
                var seriesModel = ecModel.getSeriesByName(seriesName, true);

                legendDataMap[seriesName] = itemModel;

                if (!seriesModel) {
                    // Series not exists
                    return;
                }

                var data = seriesModel.getData();
                var color = data.getVisual('color');

                if (!legendModel.isSelected(seriesName)) {
                    color = LEGEND_DISABLE_COLOR;
                }

                // If color is a callback function
                if (typeof color === 'function') {
                    // Use the first data
                    color = color(seriesModel.getFormatParams(0));
                }

                // Using rect symbol defaultly
                var legendSymbolType = data.getVisual('legendSymbol') || 'roundRect';
                var symbolType = data.getVisual('symbol');

                this._createItem(
                    seriesName, itemModel,
                    legendSymbolType, symbolType,
                    itemWidth, itemHeight, itemAlign, color,
                    selectMode, api
                );
            }, this);

            ecModel.eachSeriesAll(function (seriesModel) {
                if (seriesModel.legendDataProvider) {
                    var data = seriesModel.legendDataProvider();
                    data.each(function (idx) {
                        var name = data.getName(idx);

                        if (!legendDataMap[name]) {
                            return;
                        }

                        var color = data.getItemVisual(idx, 'color');

                        if (!legendModel.isSelected(name)) {
                            color = LEGEND_DISABLE_COLOR;
                        }

                        var legendSymbolType = 'roundRect';

                        this._createItem(
                            name, legendDataMap[name],
                            legendSymbolType, null,
                            itemWidth, itemHeight, itemAlign, color,
                            selectMode, api
                        );
                    }, false, this);
                }
            }, this);

            layout.box(
                legendModel.get('orient'),
                group,
                legendModel.get('itemGap')
            );

            positionGroup(group, legendModel, api);

            // Render backgroun after group is positioned
            // Or will get rect of group with padding
            // FIXME
            this._renderBG(legendModel, group);
        },

        // FIXME 通用？
        _renderBG: function (legendModel, group) {
            var padding = formatUtil.normalizeCssArray(
                legendModel.get('padding')
            );
            var boundingRect = group.getBoundingRect();
            var rect = new graphic.Rect({
                shape: {
                    x: boundingRect.x - padding[3],
                    y: boundingRect.y - padding[0],
                    width: boundingRect.width + padding[1] + padding[3],
                    height: boundingRect.height + padding[0] + padding[2]
                },
                style: {
                    stroke: legendModel.get('borderColor'),
                    fill: legendModel.get('backgroundColor'),
                    lineWidth: legendModel.get('borderWidth')
                },
                silent: true
            });
            graphic.subPixelOptimizeRect(rect);

            group.add(rect);
        },

        _createItem: function (
            name, itemModel,
            legendSymbolType, symbolType,
            itemWidth, itemHeight, itemAlign, color,
            selectMode, api
        ) {
            var itemGroup = new graphic.Group();

            var textStyleModel = itemModel.getModel('textStyle');

            legendSymbolType = legendSymbolType;
            itemGroup.add(symbolCreator.createSymbol(
                legendSymbolType, 0, 0, itemWidth, itemHeight, color
            ));

            // Compose symbols
            if (symbolType && symbolType !== legendSymbolType && symbolType != 'none') {
                var size = itemHeight * 0.8;
                // Put symbol in the center
                itemGroup.add(symbolCreator.createSymbol(
                    symbolType, (itemWidth - size) / 2, (itemHeight - size) / 2, size, size, color
                ));
            }

            // Text
            var textX = itemAlign === 'left' ? itemWidth + 5 : -5;
            var textAlign = itemAlign;

            var text = new graphic.Text({
                style: {
                    text: name,
                    x: textX,
                    y: itemHeight / 2,
                    fill: textStyleModel.get('color'),
                    textFont: textStyleModel.getFont(),
                    textAlign: textAlign,
                    textBaseline: 'middle'
                }
            });
            itemGroup.add(text);

            itemGroup.eachChild(function (child) {
                child.silent = !selectMode;
            });

            this.group.add(itemGroup);

            itemGroup.on('click', zrUtil.curry(createSelectActionDispatcher, this.uid, name, api), this);
        }
    });
});