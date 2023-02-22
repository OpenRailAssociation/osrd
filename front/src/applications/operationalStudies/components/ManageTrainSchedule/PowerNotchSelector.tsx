import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { get } from 'common/requests';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import { getRollingStockID, getPowerNotch } from 'reducers/osrdconf/selectors';

const ROLLINGSTOCK_URL = '/rolling_stock';

export default function PowerNotchSelector() {
  const rollingStockID = useSelector(getRollingStockID);
  const powerNotch = useSelector(getPowerNotch);
  const [rollingStockSelected, setRollingStockSelected] = useState<
    { id: number; power_restrictions: Record<string, string> } | undefined
  >(undefined);
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);

  const handleRollingStockChange = (selectedOption: { value: string; label: string }) => {
    const { value, label } = selectedOption;
    setRollingStockSelected({
      id: rollingStockID!,
      power_restrictions: { [value]: rollingStockSelected?.power_restrictions[value] ?? label },
    });
  };

  const getRollingStock = async () => {
    try {
      const rollingStock = await get(`${ROLLINGSTOCK_URL}/${rollingStockID}/`);
      const ops = Object.entries(rollingStock.power_restrictions).map(
        ([key, value]: [string, any]) => ({
          value: key,
          label: value,
        })
      );
      setOptions(ops);
      setRollingStockSelected(rollingStock);
    } catch (e) {
      console.error('ERROR', e);
    }
  };

  useEffect(() => {
    if (rollingStockID !== undefined) {
      getRollingStock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollingStockID]);

  const selectedOptions = rollingStockSelected?.power_restrictions
    ? Object.keys(rollingStockSelected.power_restrictions)[0]
    : '';

  return (
    <div className="osrd-config-item mb-2">
      <div className="osrd-config-item-container">
        <SelectImprovedSNCF
          sm
          options={options}
          selectedValue={selectedOptions}
          onChange={handleRollingStockChange}
        />
      </div>
    </div>
  );
}

PowerNotchSelector.propTypes = {};
