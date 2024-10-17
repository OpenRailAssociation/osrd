type TimetableDepartureDateProps = {
  departureDate: string | null;
};

const TimetableDepartureDate = ({ departureDate }: TimetableDepartureDateProps) => (
  <div className="scenario-timetable-departure-date">{departureDate}</div>
);

export default TimetableDepartureDate;
