const StdcmLinkedPathResult = () => {
  const test = [
    {
      trainID: '123456',
      origin: {
        date: '29/05/24',
        time: '08h50',
        opName: 'Bordeaux St Jean',
        opTrigram: 'BDX',
      },
      destination: {
        date: '29/05/24',
        time: '11h50',
        opName: 'Perrigny-Triage',
        opTrigram: 'FE',
      },
    },
  ];
  return (
    <div className="stdcm-linked-path-result">
      {test.map((trainResult) => (
        <div className="d-flex">
          {test.length > 1 && <input type="radio" aria-label="radio-button" />}
          <div className="d-flex flex-column">
            <p className="mb-1">{trainResult.trainID}</p>
            {[trainResult.origin, trainResult.destination].map((opPoint) => (
              <div className="d-flex">
                <p className="mr-2 mb-1">{opPoint.date}</p>
                <p className="mr-2 mb-1">{opPoint.time}</p>
                <p className="mr-2 mb-1">{opPoint.opName}</p>
                <p className="mb-1">{opPoint.opTrigram}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default StdcmLinkedPathResult;
