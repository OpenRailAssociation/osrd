import React from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import * as d3 from 'd3';
import './GraphTimeSpace.scss';
import * as servgraph from './ModuleGraphiques';
import * as servtime from './ModuleGraphTimeSpace';

class Graph1Legacy extends React.Component {
  static propTypes = {
    t: PropTypes.func.isRequired,
    simulation: PropTypes.object.isRequired,
  }

  componentDidMount() {
    this.drawPanelTime();
    this.drawGraphTime();
  }

  drawPanelTime = () => {
    const { t } = this.props;

    const section = servgraph.createPanel('#panel-info-time', 'panel-time');

    servgraph.createLi(section, t('osrd.graph.train'), 'li-space-info', 'li-class li-class-id', 0, 0);

    this.div_train = servgraph.createDiv(section, 'div-space-info', 'div-section', 0);
    this.li_conflit = servgraph.createLi(section, '', 'li-space-conflit', 'li-class li-class-id', 0, 0);
    this.div_conflit = servgraph.createDiv(section, 'div-space-conflit', 'div-section', 0);
    servgraph.createLi(section, t('osrd.graph.option'), 'li-space-filter', 'li-class li-class-id', 0, 0);

    const divFilter = servgraph.createDiv(section, 'div-space-filter', 'div-section', 0);
    const labelGraph = ['Graph Espace-Temps', 'Graph Temps-Espace'];
    servgraph.createSelect(divFilter, 'select-filter', 'select-filter-graph', labelGraph);

    d3.select('#select-filter-graph').on('change', () => {
      const rotateGraph = d3.select('#select-filter-graph option:checked').attr('value');
      this.drawGraphTime(this.datasetAll, rotateGraph);
    });

    // Ouvrir/Fermer les onglets du panneau info
    const ace = document.getElementsByClassName('div-section');

    d3.selectAll('.li-class').on('click', (d, i, n) => { servgraph.accordeonToggle(d, i, n, ace, '432px'); });
  }

  drawGraphTime = (datasetAll, rotateGraph) => {
    d3.select('svg').remove();
    const { t, simulation } = this.props;

    // Déclaration des variables globales
    let saveScale = 0;
    this.xDrag = 0;
    this.xScale = 0;
    this.yScale = 0;
    this.tabKeyes_Espace = [];
    this.area = '';
    this.nbTab = 0;

    if (datasetAll !== undefined) {
      this.datasetAll = datasetAll;
      this.rotateGraph = Number(rotateGraph);
    } else {
      this.datasetAll = [];
      this.rotateGraph = 0;
    }

    this.transform = undefined;
    this.ctrl_on_off = 0;
    this.zoom = 0;
    this.select_train = [];
    this.tabLast_pos_x_y = [];
    this.width = 0;
    this.height = 0;
    this.drag = 0;
    this.idTrain = 0;
    this.lines = [];

    // Variables SVG
    const margin = {
      top: 50, right: 20, bottom: 30, left: 70,
    };
    this.width = 880 - margin.left - margin.right;
    this.height = 560 - margin.top - margin.bottom;
    const svgDx = 100;
    const svgDy = 100;
    const svgDx2 = this.width - (svgDx * 2);
    const svgDy2 = this.height - svgDy;
    const svgdxET = -Infinity;
    const svgdyET = -50;
    const svgdxET2 = Infinity;
    const svgdyET2 = this.height - svgDy / 4;

    // Variables data
    const dataset = simulation.trains; // data.default.trains;
    dataset.forEach((item, idx) => this.tabKeyes_Espace.push(idx));
    // this.tabKeyes_Espace = Object.keys(dataset);
    this.nbTab = dataset.length;
    const maxUniqueValueX = [];
    const maxUniqueValueY = [];
    const minUniqueValueX = [];
    const minUniqueValueY = [];

    // Récupération des données JSON
    for (let a = 0; a < this.nbTab; a += 1) {
      this.datasetAll.push(dataset[this.tabKeyes_Espace[a]].steps);
      this.datasetAll[a].forEach((item) => {
        const d = { ...item };
        d.time = Number(d.time);
        d.tailPosition = Number(d.tailPosition);
        d.headPosition = Number(d.headPosition);
        d.speed = Number(d.speed) * 3.6;
        d.acceleration = Number(d.acceleration);
        d.currentBlocksection = Number(d.currentBlocksection);
        d.brakingDistance = Number(d.brakingDistance);
      });

      if (this.rotateGraph === 0) {
        maxUniqueValueX.push(
          d3.max(dataset[this.tabKeyes_Espace[a]].steps, (d) => d.time),
        );
        maxUniqueValueY.push(
          d3.max(dataset[this.tabKeyes_Espace[a]].steps, (d) => d.currentBlocksection),
        );
        minUniqueValueX.push(
          d3.min(dataset[this.tabKeyes_Espace[a]].steps, (d) => d.time),
        );
        minUniqueValueY.push(
          d3.min(dataset[this.tabKeyes_Espace[a]].steps, (d) => d.currentBlocksection),
        );
      } else {
        maxUniqueValueX.push(
          d3.max(dataset[this.tabKeyes_Espace[a]].steps, (d) => d.currentBlocksection),
        );
        maxUniqueValueY.push(
          d3.max(dataset[this.tabKeyes_Espace[a]].steps, (d) => d.time),
        );
        minUniqueValueX.push(
          d3.min(dataset[this.tabKeyes_Espace[a]].steps, (d) => d.currentBlocksection),
        );
        minUniqueValueY.push(
          d3.min(dataset[this.tabKeyes_Espace[a]].steps, (d) => d.time),
        );
      }

      // Construction d'un tab pour second graphique
      const id = a;
      const bool = 0;
      const idTrain = a;
      const name = this.tabKeyes_Espace[a];
      const tabSelect = {
        id, bool, idTrain, name,
      };
      this.select_train.push(tabSelect);
    }

    // Variables construction graph
    const maxValueX = d3.max(maxUniqueValueX);
    const maxValueY = d3.max(maxUniqueValueY);
    const minValueX = d3.min(minUniqueValueX);
    const minValueY = d3.min(minUniqueValueY);

    const marginGraphX = maxValueX - minValueX;
    const marginGraphY = maxValueY - minValueY;

    const domainXmin = minValueX - marginGraphX * (20 / 100);
    const domainXmax = maxValueX + marginGraphX * (10 / 100);
    const domainYmin = minValueY - marginGraphY * (10 / 100);
    const domainYmax = maxValueY + marginGraphY * (20 / 100);

    this.xScale = servgraph.xScale(this.width, domainXmin, domainXmax);
    this.yScale = servgraph.yScale(this.height, domainYmin, domainYmax);

    function tickForm(d) {
      const minutes = Math.floor(d / 60);
      const seconds = Math.floor(d % 60);
      return (seconds === 60 ? (minutes + 1) + ':00' : minutes + ':' + (Math.abs(seconds) < 10 ? '0' : '') + Math.abs(seconds));
    }

    let xAxisBottom;
    let yAxisLeft;
    let xAxisTop;
    let yAxisRight;

    if (this.rotateGraph === 0) {
      xAxisBottom = servgraph.axisBottom(this.xScale).tickFormat(tickForm);
      yAxisLeft = servgraph.axisLeft(this.yScale);
      xAxisTop = servgraph.axisTop(this.xScale).tickFormat(tickForm);
      yAxisRight = servgraph.axisRight(this.yScale);
    } else {
      xAxisBottom = servgraph.axisBottom(this.xScale);
      yAxisLeft = servgraph.axisLeft(this.yScale).tickFormat(tickForm);
      xAxisTop = servgraph.axisTop(this.xScale);
      yAxisRight = servgraph.axisRight(this.yScale).tickFormat(tickForm);
    }

    this.color = d3.scaleOrdinal(d3.schemeCategory10);

    function makeYGridlines(yscale) {
      return d3.axisLeft(yscale).ticks(10);
    }

    // Construction du SVG
    this.svg = servgraph.createSvg('#chart-time', '0 0 950 600', 'group-time', 'svg-class');
    servgraph.createRect(this.svg, this.width, this.height, margin);
    servgraph.createClipPath(this.svg, this.width, this.height);
    this.g = servgraph.createG_clipPath(this.svg, margin);
    this.focus = servgraph.createFocus(this.svg, margin);

    const gX = servgraph.creategX(this.focus, this.height, xAxisBottom);
    const gY = servgraph.creategY(this.focus, 0, yAxisLeft);
    const gX2 = servgraph.creategX(this.focus, 0, xAxisTop);
    const gY2 = servgraph.creategY(this.focus, this.width, yAxisRight);

    this.gridY = this.focus.append('g')
      .attr('class', 'grid')
      .call(makeYGridlines(this.yScale)
        .tickSize(-this.width)
        .tickFormat(d3.format('')));

    let tabtitle;
    if (this.rotateGraph === 1) {
      tabtitle = [`${t('osrd.graph.space')} (m)`, `${t('osrd.graph.time')} (s)`];
    } else {
      tabtitle = [`${t('osrd.graph.time')} (s)`, `${t('osrd.graph.space')} (m)`];
    }

    servgraph.createTitle(this.focus, this.width, this.height, margin, tabtitle[0], tabtitle[1]);

    // Instanciation du zoom
    this.zoom = servgraph.configZoom(svgDx, svgDy, svgDx2, svgDy2,
      svgdxET, svgdyET, svgdxET2, svgdyET2);

    this.zoom.on('zoom', () => {
      servgraph.zoomed(
        this.g, gX, gY, gX2, gY2, xAxisBottom, yAxisLeft,
        xAxisTop, yAxisRight, this.xScale, this.yScale,
      );
      this.transform = servgraph.transform;
      servtime.zoomedTransition(
        this.svg, this.transform, this.gridY,
        this.yScale, this.width, this.focus,
      );
      servtime.arrowmove(
        this.select_train, this.tabLast_pos_x_y, this.transform,
        this.focus, this.xScale, this.yScale,
      );
    });

    this.svg.call(this.zoom);

    this.focus.selectAll('.domain').attr('d', 'M0.5,6H790');

    // Instanciation de mousemove
    this.svg.on('mousemove', (d, i, n) => {
      let bisect;
      if (this.rotateGraph === 1) {
        bisect = d3.bisector((d) => d.tailPosition).left;
      } else {
        bisect = d3.bisector((d) => d.time).left;
      }
      this.transform = d3.zoomTransform(n[i]);
      this.tabLast_pos_x_y = servgraph.tabLast_pos_x_y;
      servgraph.mouseover(d, this.xScale, this.yScale, bisect, this.datasetAll, this.focus, this.nbTab, 0, '#group-time', this.transform, t, this.rotateGraph);
    });

    // Configuration des touches
    // 17 : CTRL / 16 : SHIFT / 18 : ALT
    window.addEventListener('keydown', (event) => {
      if (event.keyCode === 16) {
        this.zoom.scaleExtent([0.7, 100]);
      }
      if (event.keyCode === 17) {
        event.preventDefault();
        this.ctrl_on_off = 1;
        this.zoom.scaleExtent([0.7, 100]);
      }
      if (event.keyCode === 37) {
        this.xDrag = servtime.xZoom(this.transform);
        servtime.newDataDrag(this.datasetAll, this.select_train, this.xDrag);
        this.datasetAll = servtime.data;
        servtime.move_graph(this.select_train, this.g, this.area, this.lines, this.datasetAll);
        servtime.arrowmove(
          this.select_train, this.tabLast_pos_x_y, this.transform,
          this.focus, this.xScale, this.yScale,
        );
        servtime.intersection_area(
          this.select_train, this.li_conflit, this.div_conflit,
          this.g, this.area, this.svg, this.zoom, this.transform, this.datasetAll,
          this.width, this.height, this.xScale, this.yScale, t, this.rotateGraph,
        );
      }
      if (event.keyCode === 39) {
        this.xDrag = -servtime.xZoom(this.transform);
        servtime.newDataDrag(this.datasetAll, this.select_train, this.xDrag);
        this.datasetAll = servtime.data;
        servtime.move_graph(this.select_train, this.g, this.area, this.lines, this.datasetAll);
        servtime.arrowmove(this.select_train, this.tabLast_pos_x_y, this.transform,
          this.focus, this.xScale, this.yScale);
        servtime.intersection_area(this.select_train, this.li_conflit, this.div_conflit,
          this.g, this.area, this.svg, this.zoom, this.transform, this.datasetAll,
          this.width, this.height, this.xScale, this.yScale, t, this.rotateGraph);
      }
    });

    window.addEventListener('keyup', (event) => {
      if (event.keyCode === 16) {
        saveScale = this.transform.k;
        this.zoom.scaleExtent([saveScale, saveScale]);
      }
      if (event.keyCode === 17) {
        this.svg.selectAll('.areas')
          .on('click', null);
        this.ctrl_on_off = 0;
        saveScale = this.transform.k;
        this.zoom.scaleExtent([saveScale, saveScale]);
      }
    });

    // Execution de la fonction NewLine
    for (let j = 0; j < this.nbTab; j += 1) {
      this.newTrain();
    }
  }

  newTrain = () => {
    const { t } = this.props;

    // Variables NewTrain
    const keys = [t('osrd.graph.curves.tailspace'), t('osrd.graph.curves.headspace'), t('osrd.graph.curves.canton'), t('osrd.graph.curves.braking')];

    let linetailPosition;
    let lineheadPosition;
    let linecurrentBlocksection;
    let linebrakingDistance;

    if (this.rotateGraph === 0) {
      this.area = d3.area()
        .x((d) => this.xScale(d.time))
        .y0((d) => this.yScale(d.currentBlocksection))
        .y1((d) => this.yScale(d.brakingDistance))
        .curve(d3.curveStepAfter);

      linetailPosition = d3.line()
        .x((d) => this.xScale(d.time))
        .y((d) => this.yScale(d.tailPosition));

      lineheadPosition = d3.line()
        .x((d) => this.xScale(d.time))
        .y((d) => this.yScale(d.headPosition));

      linecurrentBlocksection = d3.line()
        .x((d) => this.xScale(d.time))
        .y((d) => this.yScale(d.currentBlocksection))
        .curve(d3.curveStepAfter);

      linebrakingDistance = d3.line()
        .x((d) => this.xScale(d.time))
        .y((d) => this.yScale(d.brakingDistance))
        .curve(d3.curveStepAfter);
    } else {
      this.area = d3.area()
        .y((d) => this.yScale(d.time))
        .x0((d) => this.xScale(d.currentBlocksection))
        .x1((d) => this.xScale(d.brakingDistance))
        .curve(d3.curveStepAfter);

      linetailPosition = d3.line()
        .x((d) => this.xScale(d.tailPosition))
        .y((d) => this.yScale(d.time));

      lineheadPosition = d3.line()
        .x((d) => this.xScale(d.headPosition))
        .y((d) => this.yScale(d.time));

      linecurrentBlocksection = d3.line()
        .x((d) => this.xScale(d.currentBlocksection))
        .y((d) => this.yScale(d.time))
        .curve(d3.curveStepAfter);

      linebrakingDistance = d3.line()
        .x((d) => this.xScale(d.brakingDistance))
        .y((d) => this.yScale(d.time))
        .curve(d3.curveStepAfter);
    }


    // Créations des lines et aires
    this.lines.push(linetailPosition, lineheadPosition, linecurrentBlocksection, linebrakingDistance);

    servgraph.createArea(this.g, this.datasetAll[this.idTrain], this.idTrain, this.area,
      'areas area', 'train', this.tabKeyes_Espace[this.idTrain]);

    for (let i = 0; i < 4; i += 1) {
      servgraph.createLine(this.g, this.datasetAll[this.idTrain], this.idTrain,
        i, this.lines[i], this.color(i), 'lines line', 'lane');
    }

    for (let i = 0; i < 4; i += 1) {
      const circle = servgraph.createCircle(this.focus, i, this.idTrain, 'circles circle', 'y');
      circle.style('stroke', this.color(i));
    }

    const div = servgraph.createDiv(this.div_train, 'div', 'div-trains', this.idTrain);

    const h1 = servgraph.createH1(div, 'h1-class h1-space-label', 'h1', this.idTrain, this.tabKeyes_Espace[this.idTrain]);
    h1.on('click', (d, i, n) => {
      const tabSelect = ['.label-li', '.line', '.circle', '.area'];
      servgraph.opacityLine(4, tabSelect, d, i, n);
    });
    for (let l = 0; l < 4; l += 1) {
      const liOption = servgraph.createLi(div, '', 'li-space-id', 'li-space-label li-class-lane', this.idTrain, l);
      const labelLi = servgraph.createLabel(liOption, 'class-label label-li', 'id-label',
        this.idTrain, l, `${keys[l]} : `, this.color(l));

      labelLi.on('click', (d, i, n) => {
        const tabSelect = [`#id-label${l}.label-li`, `#lane${l}.line`, `#y${l}.circle`];
        servgraph.opacityLine(3, tabSelect, d, i, n);
      });
      servgraph.createText(liOption, 'text class-focusText', 'focusText', this.idTrain, l);
    }

    servtime.intersection_area(this.select_train, this.li_conflit, this.div_conflit,
      this.g, this.area, this.svg, this.zoom, this.transform, this.datasetAll, this.width,
      this.height, this.xScale, this.yScale, t, this.rotateGraph);

    // Instanciation des fonctions drag
    this.drag = d3.drag()
      .filter(() => !d3.event.button)
      .on('start', (d, i, n) => {
        servtime.dragstarted(d, i, n, this.nbTab, this.ctrl_on_off, this.select_train,
          this.transform, this.xScale, this.yScale, this.rotateGraph);
        this.select_train = servtime.select_train;
        servgraph.updateTransform(this.transform);
      })
      .on('drag', () => {
        servtime.dragged(this.xScale, this.transform, this.yScale, this.rotateGraph);
        this.xDrag = servtime.xDrag;
        servtime.newDataDrag(this.datasetAll, this.select_train, this.xDrag);
        servtime.move_graph(this.select_train, this.g, this.area, this.lines, this.datasetAll);
        servtime.arrowmove(this.select_train, this.tabLast_pos_x_y,
          this.transform, this.focus, this.xScale, this.yScale);
      })
      .on('end', () => {
        servtime.intersection_area(this.select_train, this.li_conflit, this.div_conflit,
          this.g, this.area, this.svg, this.zoom, this.transform, this.datasetAll,
          this.width, this.height, this.xScale, this.yScale, t, this.rotateGraph);
        this.props.parentMethod(this.select_train, t);
      });

    // Fonctions contexteMenu + Copie Train
    this.g.selectAll('.areas')
      .call(this.drag)
      .on('contextmenu', (d, i, n) => {
        const idTrain = d3.select(n[i]).attr('value');
        const nameTrain = d3.select(n[i]).attr('name');
        let lineSelect;
        for (let j = 0; j < this.nbTab; j += 1) {
          if (parseInt(idTrain, 10) === j) {
            lineSelect = j;
          }
        }
        d3.selectAll('.context-menu').remove();

        const section = d3.select('section');
        const divContext = servgraph.createDiv(section, 'context-menu-space', 'context-menu', 0, 0);
        divContext.style('left', `${d3.event.pageX}px`).style('top', `${d3.event.pageY}px`);
        const h1Context = servgraph.createH1(divContext, 'h1-class-context h1', 'h1-context', 0, nameTrain);
        const liContext = servgraph.createLi(h1Context, 'New Line', 'li-context', 'li-class-context li', 0, 0);
        liContext.on('click', () => {
          this.tabKeyes_Espace.push('CopieTrain');
          servtime.generateDataNewLine(this.datasetAll, this.select_train, this.nbTab, lineSelect);
          this.nbTab += 1;
          this.newTrain();
          this.svg.call(this.zoom.transform, this.transform);
        });
        d3.select('body').on('click.context-menu', () => {
          d3.select('.context-menu').style('display', 'none');
        });
        d3.event.preventDefault();
      });

    this.idTrain += 1;
  }

  render() {
    return (
      <div className="modal-space">
        <div id="chart-time" />
        <div id="panel-info-time" />
      </div>
    );
  }
}

export default withTranslation()(Graph1Legacy);
