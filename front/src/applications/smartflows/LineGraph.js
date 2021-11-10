import React from 'react';
import PropTypes from 'prop-types';
import { ResponsiveLine } from '@nivo/line';

const MyResponsiveLine = (props) => (
  <ResponsiveLine
    data={props.smartflows.data}
    xScale={{
      type: 'time',
      format: '%Y-%m-%dT%H:%M:%S',
      precision: 'minute',
    }}
    xFormat="time:%H:%M"
    margin={{
      top: 0,
      right: 20,
      bottom: 40,
      left: 50,
    }}
    yScale={{ type: 'linear' }}
    curve="monotoneX"
    axisTop={null}
    axisBottom={{
      format: '%H:%M',
      tickValues: 'every 2 hours',
    }}
    animate
    enableGridX
    colors={{ datum: 'color' }}
    lineWidth={1}
    pointSize={0}
    pointColor={{ theme: 'background' }}
    pointBorderWidth={1}
    pointBorderColor={{ from: 'serieColor' }}
    enablePointLabel={false}
    useMesh
    enableSlices="x"
    motionStiffness={300}
    motionDamping={40}
    sliceTooltip={({ slice }) => (
      <div
        style={{
          background: 'white',
          padding: '5px 10px',
          fontSize: '.8em',
          borderRadius: '4px',
        }}
      >
        <div className="text-center">
          <strong>{slice.points[0].data.xFormatted}</strong>
        </div>
        {slice.points.map((point) => (
          <div
            key={point.id}
            style={{
              color: point.serieColor,
              padding: '3px 0',
            }}
            className="d-flex justify-content-between"
          >
            <span className="mr-2">{point.serieId}</span>
            <span className="mr-1">{Math.floor((point.data.yFormatted * 100) / props.surface) / 100}p/m²</span>
            <strong>{point.data.yFormatted}</strong>
          </div>
        ))}
      </div>
    )}
    legends={[
      {
        anchor: 'top-left',
        direction: 'column',
        justify: false,
        translateX: 30,
        translateY: 20,
        itemsSpacing: 0,
        itemDirection: 'left-to-right',
        itemWidth: 80,
        itemHeight: 20,
        itemOpacity: 0.75,
        symbolSize: 12,
        symbolShape: 'circle',
        symbolBorderColor: 'rgba(0, 0, 0, .5)',
      },
    ]}
  />
);

export default class LineGraph extends React.Component {
  static propTypes = {
    stationDetails: PropTypes.object.isRequired,
    flyToStation: PropTypes.func.isRequired,
  }

  constructor(props) {
    super(props);
    this.state = {
      nivoData: undefined,
      j: 1,
    };
  }

  nivoData = async () => {
    const { stationDetails } = this.props;
    const { j } = this.state;
    const res = await fetch(`https://static.osm.osrd.fr/smartflows/getDataUIC.php?uic=${stationDetails.id}&j=${j}`);
    const nivoData = await res.json();
    this.setState({ nivoData });
  }

  componentDidMount = () => {
    const { stationDetails } = this.props;
    if (stationDetails.id !== undefined) {
      this.nivoData();
      this.interval = setInterval(this.nivoData, 300000);
    }
  }

  componentDidUpdate = (prevProps) => {
    const { stationDetails } = this.props;
    if (stationDetails.id !== undefined && (stationDetails.id !== prevProps.stationDetails.id)) {
      this.nivoData();
      clearInterval(this.interval);
      this.interval = setInterval(this.nivoData, 300000);
    }
  }

  componentWillUnmount = () => {
    clearInterval(this.interval);
  }

  compareRef1 = () => {
    this.setState({ j: 1 }, () => this.nivoData());
  }

  compareRef7 = () => {
    this.setState({ j: 7 }, () => this.nivoData());
  }

  render() {
    const { nivoData } = this.state;
    console.log('UPDATE LINEGRAPH');
    const { flyToStation, stationDetails } = this.props;
    if (stationDetails.id !== undefined && nivoData !== undefined) {
      return (
        <div className="infos-gare">
          <div className="infos-gare-title d-flex">
            <span className="flex-grow-1">{stationDetails.name}</span>
            <button type="button" onClick={this.compareRef1}>
              <strong>
                <i className="icons-circle-delay mr-1" />
                J-1
              </strong>
            </button>
            <button type="button" onClick={this.compareRef7}>
              <strong>
                <i className="icons-circle-delay mr-1" />
                J-7
              </strong>
            </button>
            <button type="button" onClick={flyToStation}>
              <i className="icons-localisation-pin" />
            </button>
          </div>
          <div className="infos-gare-subtitle d-flex justify-content-between">
            <span>
              <span>
                <strong className="mr-1">Densité actuelle</strong>
                <small className="font-weight-bold rounded-lg py-1 px-2 bg-gray text-white mr-1">
                   {stationDetails.density / 100}p/m²
                </small>
                <strong className="ml-2 mr-1">maximums</strong>
                <small className="font-weight-bold rounded-lg py-1 px-2 bg-primary text-white mr-1">
                  {Math.floor((nivoData.maxtoday * 100) / stationDetails.surface) / 100}p/M²
                </small>
                <small className="font-weight-bold rounded-lg py-1 px-2 bg-green mr-1">
                  {Math.floor((nivoData.maxyesterday * 100) / stationDetails.surface) / 100}p/M²
                </small>
                <small className="font-weight-bold rounded-lg py-1 px-2 bg-purple text-white mr-1">
                  {Math.floor((nivoData.maxref * 100) / stationDetails.surface) / 100}p/M²
                </small>
              </span>
            </span>
            <span>Surface {stationDetails.surface}M²</span>
            <span>{stationDetails.people} personnes</span>
          </div>
          <MyResponsiveLine smartflows={nivoData} surface={stationDetails.surface} />
        </div>
      );
    }
    return <></>;
  }
}
