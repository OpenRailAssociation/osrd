import { StyleSheet, Font } from '@react-pdf/renderer';

import IBMPlexMonoBold from 'assets/simulationReportSheet/fonts/IBM-Plex-Mono/IBMPlexMono-Bold.ttf';
import IBMPlexMonoMedium from 'assets/simulationReportSheet/fonts/IBM-Plex-Mono/IBMPlexMono-Medium.ttf';
import IBMPlexMonoRegular from 'assets/simulationReportSheet/fonts/IBM-Plex-Mono/IBMPlexMono-Regular.ttf';
import IBMPlexMonoSemiBold from 'assets/simulationReportSheet/fonts/IBM-Plex-Mono/IBMPlexMono-SemiBold.ttf';
import IBMPlexSansBold from 'assets/simulationReportSheet/fonts/IBM-Plex-Sans/IBMPlexSans-Bold.ttf';
import IBMPlexSansItalic from 'assets/simulationReportSheet/fonts/IBM-Plex-Sans/IBMPlexSans-Italic.ttf';
import IBMPlexSansMedium from 'assets/simulationReportSheet/fonts/IBM-Plex-Sans/IBMPlexSans-Medium.ttf';
import IBMPlexSansRegular from 'assets/simulationReportSheet/fonts/IBM-Plex-Sans/IBMPlexSans-Regular.ttf';
import IBMPlexSansSemiBold from 'assets/simulationReportSheet/fonts/IBM-Plex-Sans/IBMPlexSans-SemiBold.ttf';

Font.register({
  family: 'IBM Plex Sans',
  fonts: [
    { src: IBMPlexSansRegular, fontWeight: 'normal' },
    { src: IBMPlexSansMedium, fontWeight: 'medium' },
    { src: IBMPlexSansSemiBold, fontWeight: 'semibold' },
    { src: IBMPlexSansBold, fontWeight: 'bold' },
    { src: IBMPlexSansItalic, fontStyle: 'italic' },
  ],
});

Font.register({
  family: 'IBM Plex Mono',
  fonts: [
    { src: IBMPlexMonoRegular, fontWeight: 'normal' },
    { src: IBMPlexMonoMedium, fontWeight: 'medium' },
    { src: IBMPlexMonoSemiBold, fontWeight: 'semibold' },
    { src: IBMPlexMonoBold, fontWeight: 'bold' },
  ],
});

const styles = {
  main: StyleSheet.create({
    page: {
      backgroundColor: '#FFFFFF',
      width: '100vw',
      fontFamily: 'IBM Plex Sans',
    },
  }),
  header: StyleSheet.create({
    alertBanner: {
      height: '64',
      backgroundColor: '#000000',
      color: '#FFF700',
      flexDirection: 'row',
      alignItems: 'center',
    },
    alertIcon: {
      width: '24',
      height: '24',
      marginLeft: '20',
    },
    simulationTitle: {
      fontSize: '28',
      fontWeight: 'semibold',
      marginLeft: '19.03',
      marginBottom: '2',
      letterSpacing: '-0.35',
    },
    message: {
      fontSize: '16',
      marginLeft: '28',
      letterSpacing: '-0.20',
    },
    numberDateBanner: {
      height: '96',
      backgroundColor: '#F6F8F9',
      color: '#000000',
      display: 'flex',
      flexDirection: 'row',
    },
    stdcmTitleBox: {
      width: '400',
    },
    stdcm: {
      flexDirection: 'column',
      marginLeft: '40',
    },
    title: {
      fontFamily: 'IBM Plex Sans',
      fontWeight: 'bold',
      fontSize: '23',
      marginTop: '24',
      letterSpacing: '-0.29',
    },
    creation: {
      fontSize: '13',
      marginBottom: '30',
      letterSpacing: '-0.16',
    },
    numericInfo: {
      width: '196',
      height: '56',
      backgroundColor: '#E9EFF2',
      borderRadius: '7',
      marginTop: '20',
      marginBottom: '20',
      fontFamily: 'IBM Plex Mono',
    },
    number: {
      fontSize: '16',
      fontWeight: 'bold',
      letterSpacing: '-0.2',
      marginLeft: '12',
      marginTop: '10',
      marginBottom: '3',
    },
    creationDate: {
      fontSize: '14',
      letterSpacing: '-0.17',
      marginLeft: '12',
    },
    sncfLogo: {
      width: '69.21',
      height: '48',
      marginTop: '20',
      marginRight: '39.79',
      marginLeft: 'auto',
    },
  }),
  rcInfo: StyleSheet.create({
    rcInfo: {
      height: '160',
      color: '#000000',
      borderBottom: '1 solid #D3D1CF',
      display: 'flex',
      flexDirection: 'row',
    },
    rcBox: {
      width: '400',
    },
    rcName: {
      fontSize: '18',
      fontWeight: 'semibold',
      marginLeft: '40',
      marginTop: '22',
      marginBottom: '3',
      color: '#005BC1',
      letterSpacing: '-0.22',
    },
    rcPersonName: {
      fontSize: '16',
      marginLeft: '40',
      color: '#005BC1',
      letterSpacing: '-0.2',
    },
    rcPhoneNumber: {
      fontSize: '18',
      marginTop: '22',
      marginBottom: '3',
      color: '#005BC1',
      letterSpacing: '-0.22',
    },
    rcMail: {
      fontSize: '16',
      color: '#005BC1',
      letterSpacing: '-0.2',
    },
    stdcmApplication: {
      marginTop: '25',
    },
    applicationDate: {
      fontSize: '14',
      color: '#797671',
    },
    date: {
      fontSize: '24',
      fontWeight: 'semibold',
      marginBottom: '25',
    },
    referencePath: {
      fontSize: '14',
      color: '#797671',
    },
    pathNumber: {
      fontSize: '24',
      marginBottom: '29',
      fontWeight: 'semibold',
    },
  }),
  convoyAndRoute: StyleSheet.create({
    convoyAndRoute: {
      height: 'auto',
      display: 'flex',
      flexDirection: 'row',
    },
    convoy: {
      marginLeft: '16',
      paddingRight: '32',
      borderRight: '1 solid #D3D1CF',
    },
    convoyTitle: {
      marginTop: '13',
      marginBottom: '13',
      marginLeft: '4',
      textTransform: 'uppercase',
      fontSize: '18',
      fontWeight: 'bold',
      color: '#000000',
      letterSpacing: '0.4',
    },
    convoyInfo: {
      width: '368',
      height: '100%',
      marginBottom: '16',
      backgroundColor: '#EFF3F5',
      display: 'flex',
      flexDirection: 'row',
    },
    convoyInfoBox1: {
      width: '197',
      marginLeft: '24',
      marginTop: '17',
    },
    convoyInfoBox2: {
      width: '147',
      marginTop: '17',
    },
    convoyInfoTitles: {
      color: '#797671',
      fontSize: '14',
    },
    convoyInfoData: {
      color: '#000000',
      fontFamily: 'IBM Plex Mono',
      fontSize: '16',
      fontWeight: 'semibold',
      marginBottom: '15',
    },
    route: {
      width: '960',
      marginLeft: '16',
    },
    routeTitle: {
      marginTop: '13',
      marginBottom: '9',
      marginLeft: '4',
      textTransform: 'uppercase',
      fontSize: '18',
      fontWeight: 'bold',
      color: '#000000',
      letterSpacing: '0.4',
    },
    fromBanner: {
      height: '32',
      width: '912',
      backgroundColor: '#F6F8F9',
      marginBottom: '13',
      display: 'flex',
      flexDirection: 'row',
    },
    fromBox: {
      width: '64',
      height: '32',
      textAlign: 'center',
      backgroundColor: '#70C1E5',
    },
    from: {
      fontSize: '16',
      fontWeight: 'semibold',
      textTransform: 'uppercase',
      color: '#FFFFFF',
      marginTop: '5',
    },
    fromNumber: {
      fontFamily: 'IBM Plex Mono',
      fontSize: '16',
      fontWeight: 'medium',
      marginLeft: '16',
      marginTop: '5',
      letterSpacing: '-0.2',
    },
    fromScheduled: {
      fontSize: '14',
      marginLeft: '16',
      marginTop: '6',
    },
    stopTableContainer: {
      backgroundColor: '#EFF3F5',
      marginBottom: 13,
      height: 'auto',
      width: '912',
    },
    stopTable: {
      border: 'none',
    },
    stopTableIndexWidth: {
      width: '40',
    },
    stopTableOpWidth: {
      width: '256',
    },
    stopTableChWidth: {
      width: '112',
    },
    stopTableEndWidth: {
      width: '118',
    },
    stopTableStartWidth: {
      width: '168',
    },
    stopTableMotifWidth: {
      width: '216',
    },
    stopTableTH: {
      fontSize: '14',
      fontWeight: 'normal',
      color: '#797671',
      padding: '10',
    },
    stopTableIndexColumn: {
      fontFamily: 'IBM Plex Mono',
      fontSize: '16',
      fontWeight: 'medium',
      color: '#000000',
      opacity: 0.25,
      paddingLeft: '16',
    },
    stopTableOpColumn: {
      fontSize: '16',
      fontWeight: 'semibold',
      color: '#000000',
      letterSpacing: '-0.2',
      paddingLeft: '6',
    },
    stopTableChColumn: {
      fontSize: '14',
      color: '#797671',
      fontWeight: 'medium',
      letterSpacing: '-0.17',
      paddingLeft: '6',
    },
    stopTableItalicColumn: {
      fontSize: '16',
      fontStyle: 'italic',
      color: '#000000',
      letterSpacing: '-0.2',
    },
    stopTableStartColumn: {
      fontSize: '16',
      fontFamily: 'IBM Plex Mono',
      fontWeight: 'medium',
      color: '#000000',
      letterSpacing: '-0.2',
    },
    stopTableTD: {
      fontSize: '14',
      padding: '6',
    },
    stopTableTbody: {
      height: '40',
      borderTop: '1.6 solid #D3D1CF',
    },
    forBanner: {
      height: '32',
      width: '912',
      backgroundColor: '#F6F8F9',
      marginBottom: '16',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    forBox: {
      width: '64',
      height: '32',
      textAlign: 'center',
      backgroundColor: '#70C1E5',
    },
    for: {
      fontSize: '16',
      fontWeight: 'semibold',
      textTransform: 'uppercase',
      color: '#FFFFFF',
      marginTop: '5',
    },
    forNumber: {
      fontFamily: 'IBM Plex Mono',
      fontSize: '16',
      fontWeight: 'medium',
      marginRight: '16',
      marginTop: '5',
      letterSpacing: '-0.2',
    },
    forScheduled: {
      fontSize: '14',
      marginRight: '16',
      marginTop: '8',
    },
  }),
  simulation: StyleSheet.create({
    simulation: {
      paddingBottom: '17',
      borderBottom: '1 solid #D3D1CF',
    },
    simulationContainer: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTop: '1 solid #D3D1CF',
    },
    simulationUppercase: {
      textTransform: 'uppercase',
      fontSize: '18',
      fontWeight: 'bold',
      marginLeft: '16',
      marginTop: '12',
      marginBottom: '12',
      color: '#000000',
      letterSpacing: '-0.22',
    },
    viewSimulation: {
      color: '#1844EF',
      textDecoration: 'none',
      fontWeight: 'semibold',
      fontSize: '14',
      marginTop: '18',
      marginLeft: '900',
    },
    simulationLength: {
      fontSize: '21',
      fontWeight: 400,
      marginRight: '16',
      marginTop: '12',
      marginBottom: '12',
      color: '#494641',
      letterSpacing: '-0.26',
    },
    tableContainer: {
      marginLeft: '16',
      marginRight: '16',
      backgroundColor: '#EFF3F5',
      paddingBottom: '16',
    },
    table: {
      border: 'none',
    },
    th: {
      fontSize: '14',
      fontWeight: 'normal',
      color: '#797671',
      padding: '16 0',
    },
    indexWidth: {
      width: '56',
    },
    opWidth: {
      width: '272',
    },
    chWidth: {
      width: '88',
    },
    trackWidth: {
      width: '120',
    },
    endWidth: {
      width: '90',
    },
    passageWidth: {
      width: '100',
    },
    startWidth: {
      width: '139',
    },
    weightWidth: {
      width: '96',
    },
    refEngineWidth: {
      width: '155',
    },
    convSignWidth: {
      width: '112',
    },
    crossedATEWidth: {
      width: '67',
    },
    indexColumn: {
      fontFamily: 'IBM Plex Mono',
      fontSize: '14',
      fontWeight: 'medium',
      paddingLeft: '12',
      paddingRight: '16',
      color: '#000000',
      opacity: 0.25,
    },
    chColumn: {
      fontSize: '16',
      fontWeight: 'semibold',
      marginLeft: '16',
    },
    stopColumn: {
      fontFamily: 'IBM Plex Mono',
      fontSize: '16',
      fontWeight: 'medium',
      marginLeft: '14',
    },
    blueStop: {
      height: '20',
      fontSize: '16',
      fontWeight: 'medium',
      backgroundColor: '#216482',
      color: '#FFFFFF',
      borderRadius: '12',
      padding: '0 8',
      marginLeft: '8',
      marginTop: '1',
      marginBottom: '1',
    },
    td: {
      fontSize: '14',
      fontWeight: 'normal',
      color: '#312E2B',
      paddingLeft: '16',
    },
    opStop: {
      fontSize: '14',
      fontWeight: 'semibold',
      color: '#312E2B',
      paddingLeft: '16',
    },
    tbody: {
      backgroundColor: '#FFFFFF',
      height: '24',
      borderRadius: '4',
      border: '0.5 solid #D3D1CF',
      marginLeft: '8',
      marginRight: '8',
      marginTop: '4',
    },
    blueRow: {
      backgroundColor: '#E6F7FF',
      borderColor: '#216482',
      height: '24',
      borderRadius: '4',
      border: '0.5 solid #216482',
      marginLeft: '8',
      marginRight: '8',
      marginTop: '4',
    },
    horizontalBar: {
      width: '36',
      height: '4',
      borderRadius: '7',
      backgroundColor: '#B6B2AF',
      marginTop: '16',
      marginLeft: '16',
    },
  }),
  map: StyleSheet.create({
    map: {
      width: '1312',
      height: 'auto',
      marginTop: '17',
      marginLeft: '16',
      marginRight: '16',
      border: '1 solid #1F1B17',
      backgroundColor: '#EBEBEA',
    },
  }),
  footer: StyleSheet.create({
    warrantyBox: {
      height: '64',
      marginTop: '16',
      borderTop: '1 solid #D3D1CF',
      display: 'flex',
      alignItems: 'center',
    },
    warrantyMessage: {
      fontSize: '14',
      marginTop: '20',
      marginBottom: '24',
      color: '#797671',
    },
  }),
};

export default styles;
