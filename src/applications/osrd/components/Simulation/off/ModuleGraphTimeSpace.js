import * as d3 from 'd3'

export var select_train;
export var xDrag;
export var data;
export var zoomCurrent;
var pos1;
var pos2;

export function zoomedTransition(svg, transform, gridY, yScale, width, focus) {
    svg.selectAll('#lane0, #lane1, #lane2, #lane3').attr("stroke-width", 2 / transform.k);

    gridY.call(
        d3.axisLeft(yScale)
        .scale(transform.rescaleY(yScale))
        .ticks(10)
        .tickSize(-width)
        .tickFormat(d3.format(""))
    );

    focus.selectAll(".domain").attr("d", "M0.5,6H790")
}

export function xZoom(transform) {
    let currentZoom = Math.trunc(transform.k * 10);

    if (currentZoom < 5) { zoomCurrent = 200; }
    if (currentZoom > 5 && currentZoom <= 10) { zoomCurrent = 100; }
    if (currentZoom > 10 && currentZoom < 20) { zoomCurrent = 50; }
    if (currentZoom > 20 && currentZoom < 30) { zoomCurrent = 25; }
    if (currentZoom > 30 && currentZoom < 55) { zoomCurrent = 10; }
    if (currentZoom > 55) { zoomCurrent = 1; }

    return zoomCurrent;
}

export function mouseoverTime(transform, j, focus, xscale, yscale, d, t, rotateGraph) {
    for (let i = 0; i < 4; i++) {
        const line_object = [d.tailPosition, d.headPosition, d.currentBlocksection, d.brakingDistance];

        if (rotateGraph === 1) {
            focus.select(".circle" + j + "#y" + i)
                .attr('cx', () => {
                    return transform.applyX(xscale(line_object[i]));
                })
                .attr('cy', () => {
                    return transform.applyY(yscale(d.time));
                });
        } else {
            focus.select(".circle" + j + "#y" + i)
                .attr('cx', () => {
                    return transform.applyX(xscale(d.time));
                })
                .attr('cy', () => {
                    return transform.applyY(yscale(line_object[i]));
                });
        }


        var minutes = Math.floor(d.time / 60);
        var seconds = Math.floor(d.time % 60);

        d3.select('.class-focusText' + j + '#focusText' + i)
            .text(t('osrd.graph.time') + " : " + (seconds === 60 ? (minutes + 1) + ":00" : minutes + ":" + (Math.abs(seconds) < 10 ? "0" : "") + Math.abs(seconds)) + " s" + " | " + t('osrd.graph.space') + " : " + Math.round(line_object[i] * 100) / 100 + " m" + " | " + t('osrd.graph.speed') + " : " + Math.round(d.speed * 100 * 3.6) / 100 + " km/h");
    }
}

export function mouseXdrag(scale, gvalue) {
    var g = d3.select("#group-time").node();
    var value = scale.invert(d3.mouse(g)[gvalue] - 68);
    return value;
}

export function dragstarted(d, i, n, nbTab, ctrl_on_off, train_select, transform, xscale, yscale, rotateGraph) {
    d3.event.sourceEvent.stopPropagation();
    if (rotateGraph === 1) {
        var xt = transform.rescaleY(yscale);
    } else {
        var xt = transform.rescaleX(xscale);
    }
    pos1 = mouseXdrag(xt, rotateGraph);
    var nbTrainSelect = 0;
    var train = d3.select(n[i]).attr("id");
    select_train = train_select;
    for (let j = 0; j < nbTab; j++) {
        if (select_train[j].bool === 1) {
            nbTrainSelect += 1;
        }
    }
    if (nbTrainSelect < 2 && ctrl_on_off === 0) {
        d3.selectAll(".circles").style("opacity", "0");
        d3.selectAll(".div-trains").style("height", "0%");
        d3.selectAll(".areas").style("fill", "rgba(0, 0, 0, 0.2)");
        for (let j = 0; j < nbTab; j++) {
            select_train[j].bool = 0;
            if (train === "train" + j) {
                select_train[j].bool = 1;
                d3.select(n[i]).style("fill", "rgba(34, 45, 178, 0.6)");
                d3.selectAll(".circle" + j).style("opacity", "1");
                d3.select("#div" + j).style("height", "220px");
            }
        }
    }
    if (nbTrainSelect > 2 && ctrl_on_off === 0) {
        for (let j = 0; j < nbTab; j++) {
            if (train === "train" + j) {
                if (select_train[j].bool === 0) {
                    for (let n = 0; n < nbTab; n++) {
                        select_train[n].bool = 0;
                    }
                    d3.selectAll(".circles").style("opacity", "0");
                    d3.selectAll(".div-trains").style("height", "0%");
                    d3.selectAll(".areas").style("fill", "rgba(0, 0, 0, 0.2)");
                    select_train[j].bool = 1;
                    d3.select(n[i]).style("fill", "rgba(34, 45, 178, 0.6)");
                    d3.selectAll(".circle" + j).style("opacity", "1");
                    d3.select("#div" + j).style("height", "220px");
                }
            }
        }
    }
    if (ctrl_on_off === 1) {
        for (let j = 0; j < nbTab; j++) {
            if (train === "train" + j) {
                if (select_train[j].bool === 0) {
                    select_train[j].bool = 1;
                    d3.select(n[i]).style("fill", "rgba(34, 45, 178, 0.6)");
                } else {
                    select_train[j].bool = 0;
                    d3.select(n[i]).style("fill", "rgba(0, 0, 0, 0.2)");
                }
            }
        }
        d3.selectAll(".circles").style("opacity", "0");
        d3.selectAll(".div-trains").style("height", "0%");
        for (let j = 0; j < select_train.length; j++) {
            if (select_train[j].bool === 1) {
                d3.selectAll(".circle" + j).style("opacity", "1");
                d3.select("#div" + j).style("height", "220px");
            }
        }
    }
}

export function dragged(xscale, transform, yscale, rotateGraph) {
    d3.event.sourceEvent.stopPropagation();
    if (rotateGraph === 1) {
        var xt = transform.rescaleY(yscale);
    } else {
        var xt = transform.rescaleX(xscale);
    }
    pos2 = mouseXdrag(xt, rotateGraph);
    xDrag = pos1 - pos2;
    xDrag = Math.round(xDrag * 1) / 1;
    pos1 = pos2;
}

export function newDataDrag(datatrain, select_train, xDrag) {
    data = datatrain;
    for (var a = 0; a < select_train.length; a++) {
        if (select_train[a].bool === 1) {
            data[a].forEach(function(d) {
                d.time = d.time - xDrag;
            })
        }
    }
}

export function move_graph(select_train, g, area, lines, data) {
    d3.selectAll(".intersection-area").remove();
    for (let j = 0; j < select_train.length; j++) {
        if (select_train[j].bool === 1) {
            for (let i = 0; i < 4; i++) {
                g.select("#lane" + i + ".line" + select_train[j].id)
                    .datum(data[j])
                    .attr("d", lines[i]);
            }
        }
    }
    for (let j = 0; j < select_train.length; j++) {
        if (select_train[j].bool === 1) {
            g.select("#train" + select_train[j].id)
                .datum(data[j])
                .attr("d", area);
        }
    }
}

export function arrowmove(select_train, tabLast_pos_x_y, transform, focus, xscale, yscale) {
    for (let j = 0; j < select_train.length; j++) {
        if (select_train[j].bool === 1) {
            for (let i = 0; i < 4; i++) {

                const line_object = [tabLast_pos_x_y[j].tailPosition, tabLast_pos_x_y[j].headPosition, tabLast_pos_x_y[j].currentBlocksection, tabLast_pos_x_y[j].brakingDistance];

                focus.select(".circle" + j + "#y" + i)
                    .attr('cx', () => {
                        return transform.applyX(xscale(tabLast_pos_x_y[j].time));
                    })
                    .attr('cy', () => {
                        return transform.applyY(yscale(line_object[i]));
                    });

                var minutes = Math.floor(tabLast_pos_x_y[j].time / 60);
                var seconds = Math.floor(tabLast_pos_x_y[j].time % 60);


                d3.select('.class-focusText' + j + '#focusText' + i)
                    .text("Time : " + (seconds === 60 ? (minutes + 1) + ":00" : minutes + ":" + (Math.abs(seconds) < 10 ? "0" : "") + Math.abs(seconds)) + " s" + " | Space : " + Math.round(line_object[i] * 100) / 100 + " m" + " |  : " + Math.round(tabLast_pos_x_y[j].speed * 100) / 100 + " km/h");
            }
        }
    }
}

export function intersection_area(select_train, li_conflit, div_conflit, g, area, svg, zoom, transform, data, width, height, xscale, yscale, t, rotateGraph) {
    let tab_errors_area = [];
    let tab_conflits = [];
    var nbconflit = 0;
    var l = 0;
    for (var j = 0; j < select_train.length - 1; j++) {
        for (var i = j + 1; i < select_train.length; i++) {
            tab_errors_area.push(operation(data[j], data[i], data[i], data[j]));
            l++;
            var tab = { j, i };
            tab_conflits.push(tab);
        }
    }
    for (var i = 0; i < l; i++) {
        nbconflit += tab_errors_area[i].length;
    }
    li_conflit.text(t('osrd.graph.conflict') + " (" + nbconflit + ")");
    d3.selectAll(".li-details-conflits").remove();
    d3.selectAll(".train-conflit").remove();
    for (var j = 0; j < tab_errors_area.length; j++) {
        if (tab_errors_area[j].length !== 0) {
            div_conflit.append("h3")
                .attr("class", "train-conflit")
                .attr("style", "font-weight:bold; font-size:13")
                .text(t('osrd.graph.between') + tab_conflits[j].j + " & " + t('osrd.graph.train') + tab_conflits[j].i + " (" + tab_errors_area[j].length + t('osrd.graph.conflict') + ")")
        }
        for (var i = 0; i < tab_errors_area[j].length; i++) {
            var endpoint = tab_errors_area[j][i].length - 1;
            var tabValue = [j, i, tab_errors_area];
            var minutesFirstPoint = Math.floor(tab_errors_area[j][i][0].time / 60);
            var secondsFirstPoint = Math.floor(tab_errors_area[j][i][0].time % 60);
            var minutesLastPoint = Math.floor(tab_errors_area[j][i][endpoint].time / 60);
            var secondsLastPoint = Math.floor(tab_errors_area[j][i][endpoint].time % 60);
            div_conflit.append("li")
                .attr("style", "font-weight:bolder;font-size:13px;cursor: pointer")
                .attr("class", "li-details-conflits")
                .datum(tabValue)
                .text((secondsFirstPoint === 60 ? (minutesFirstPoint + 1) + ":00" : minutesFirstPoint + "." + (Math.abs(secondsFirstPoint) < 10 ? "0" : "") + Math.abs(secondsFirstPoint)) + " " + t('osrd.graph.seconds') + " => " + (secondsLastPoint === 60 ? (minutesLastPoint + 1) + ":00" : minutesLastPoint + "." + (Math.abs(secondsLastPoint) < 10 ? "0" : "") + Math.abs(secondsLastPoint)) + " " + t('osrd.graph.seconds'));
        }
    }

    for (var j = 0; j < tab_errors_area.length; j++) {
        for (var i = 0; i < tab_errors_area[j].length; i++) {
            g.append('path')
                .datum(tab_errors_area[j][i])
                .attr("class", "intersection-area area")
                .attr('fill', "rgba(178, 34, 34, 0.6)")
                .attr('d', area);
        }
    }

    d3.selectAll(".li-details-conflits")
        .on("click", (d, i, n) => {
            focus_zoomed(d, i, n, xscale, yscale, transform, zoom, width, height, svg, rotateGraph)
        });

    if (transform !== undefined) {
        svg.call(zoom.transform, transform);

    }
}

export function operation(FreinageT0, FreinageT1, CantonT1, CantonT0) {
    var firstpoint = FreinageT0[0].time - FreinageT1[0].time;
    firstpoint = Math.abs(firstpoint);
    var lengthtrain = Math.min(FreinageT1.length, FreinageT0.length);
    var freinageif;
    var cantonif;
    var l = 0;
    var o = 0;
    var p = 0;
    var tabResult = [];
    var result = [];
    freinageif = FreinageT1;
    cantonif = CantonT0;
    for (var i = firstpoint; i < lengthtrain; i++) {
        if (FreinageT0[0].time >= FreinageT1[0].time && FreinageT0[l].brakingDistance >= FreinageT1[i].brakingDistance) {
            freinageif = FreinageT1;
            cantonif = CantonT0;
            o = l;
            p = i;
        }
        if (FreinageT1[0].time >= FreinageT0[0].time && FreinageT1[l].brakingDistance >= FreinageT0[i].brakingDistance) {
            freinageif = FreinageT0;
            cantonif = CantonT1;
            o = l;
            p = i;
        }
        if (FreinageT1[0].time >= FreinageT0[0].time && FreinageT0[i].brakingDistance >= FreinageT1[l].brakingDistance) {
            freinageif = FreinageT1;
            cantonif = CantonT0;
            o = i;
            p = l;
        }
        if (FreinageT0[0].time >= FreinageT1[0].time && FreinageT1[i].brakingDistance >= FreinageT0[l].brakingDistance) {
            freinageif = FreinageT0;
            cantonif = CantonT1;
            o = i;
            p = l;
        }
        if (freinageif[p].brakingDistance >= cantonif[o].currentBlocksection) {
            var brakingDistance = freinageif[p].brakingDistance;
            var time = freinageif[p].time;
            var currentBlocksection = cantonif[o].currentBlocksection;
            var tab = { time, currentBlocksection, brakingDistance };
            tabResult.push(tab);
        } else {
            if (tabResult.length !== 0) {
                result.push(tabResult);
                tabResult = [];
            }
        }
        l++
    }
    if (tabResult.length !== 0) {
        result.push(tabResult);
    }
    return result;
}

function focus_zoomed(d, i, n, xscale, yscale, transform, zoom, width, height, svg, rotateGraph) {
    var value_li = d3.select(n[i]).datum()
    var endpoint = value_li[2][value_li[0]][value_li[1]].length - 1;
    if (rotateGraph === 1) {
        var calculX = (value_li[2][value_li[0]][value_li[1]][0].brakingDistance + value_li[2][value_li[0]][value_li[1]][endpoint].brakingDistance) / 2;
        var calculY = (value_li[2][value_li[0]][value_li[1]][0].time + value_li[2][value_li[0]][value_li[1]][endpoint].time) / 2;
    } else {
        var calculX = (value_li[2][value_li[0]][value_li[1]][0].time + value_li[2][value_li[0]][value_li[1]][endpoint].time) / 2;
        var calculY = (value_li[2][value_li[0]][value_li[1]][0].brakingDistance + value_li[2][value_li[0]][value_li[1]][endpoint].brakingDistance) / 2;
    }

    calculX = xscale(calculX) * 100;
    calculY = yscale(calculY) * 100;

    svg.call(zoom.transform, d3.zoomIdentity.translate((width / 2 - calculX), (height / 2 - calculY)).scale(100))

    //zoom.scaleExtent([transform.k, transform.k]);
}

export function generateDataNewLine(data, select_trains, nbTab, line_create) {
    select_train = select_trains
    const length_line_drag = data[line_create].length;

    let tabNewTrain = [];
    for (let i = 0; i < length_line_drag; i++) {
        const time = data[line_create][i].time;
        const headPosition = data[line_create][i].headPosition;
        const tailPosition = data[line_create][i].tailPosition;
        const speed = data[line_create][i].speed;
        const acceleration = data[line_create][i].acceleration;
        const currentBlocksection = data[line_create][i].currentBlocksection;
        const brakingDistance = data[line_create][i].brakingDistance;
        const tab = { time, headPosition, tailPosition, speed, acceleration, currentBlocksection, brakingDistance };
        tabNewTrain.push(tab)
    }

    data.push(tabNewTrain);

    var id = select_train.length;
    var bool = 0;
    var id_train = select_train[line_create].id_train;
    var name = "Copie Train";
    var tab_select = { id, bool, id_train, name };
    select_train.push(tab_select);

    data[nbTab].forEach(function(d) {
        d.time = d.time + 300;
    })
}
