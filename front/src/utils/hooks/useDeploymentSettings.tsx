import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import defaultLogo from 'assets/logo-color.svg';
import defaultOsrdLogo from 'assets/logo-osrd-color-white.svg';
import proudLogo from 'assets/proud-logo-color.svg';
import proudOsrdLogo from 'assets/proud-logo-osrd-color-white.svg';
import xmasLogo from 'assets/xmas-logo-color.svg';
import xmasOsrdLogo from 'assets/xmas-logo-osrd-color-white.svg';

const MONTH_VALUES = {
  JUNE: 5,
  DECEMBER: 11,
};

const defaultSettings = {
  digitalTwinName: 'Osrd',
  digitalTwinLogo: defaultLogo,
  digitalTwinLogoWithName: defaultOsrdLogo,
  stdcmName: 'Stdcm',
  stdcmLogo: undefined,
  stdcmSimulationSheetLogo: undefined,
  isCustomizedDeployment: false,
};

export type DeploymentSettings = {
  digitalTwinName: string;
  digitalTwinLogo: string;
  digitalTwinLogoWithName: string;
  stdcmName: string;
  stdcmLogo?: string;
  stdcmSimulationSheetLogo?: string;
  isCustomizedDeployment: boolean;
  stdcmFeedbackMail?: string;
};

export type DeploymentSettingsContext = {
  isLoading: boolean;
  deploymentSettings?: DeploymentSettings;
} | null;

const deploymentSettingsContext = createContext<DeploymentSettingsContext>(null);

type DeploymentContextProviderProps = { children: ReactNode };

export const DeploymentContextProvider = ({ children }: DeploymentContextProviderProps) => {
  const [customizedDeploymentSetting, setCustomizedDeploymentSetting] =
    useState<DeploymentSettingsContext>({
      isLoading: true,
    });

  useEffect(() => {
    const fetchInternalProd = async () => {
      try {
        const response = await fetch('/overrides/overrides.json');
        if (!response.ok || response.headers.get('Content-Type') !== 'application/json') {
          let digitalTwinLogo = defaultLogo;
          let digitalTwinLogoWithName = defaultOsrdLogo;
          const currentMonth = new Date().getMonth();

          if (currentMonth === MONTH_VALUES.JUNE) {
            digitalTwinLogo = proudLogo;
            digitalTwinLogoWithName = proudOsrdLogo;
          } else if (currentMonth === MONTH_VALUES.DECEMBER) {
            digitalTwinLogo = xmasLogo;
            digitalTwinLogoWithName = xmasOsrdLogo;
          }

          setCustomizedDeploymentSetting({
            isLoading: false,
            deploymentSettings: {
              ...defaultSettings,
              digitalTwinLogo,
              digitalTwinLogoWithName,
            },
          });
        } else {
          const overridesData = await response.json();
          const { icons, names, stdcm_feedback_mail } = overridesData;

          const lmrLogoPath = `/overrides/${icons.stdcm.light}.svg`;
          const lmrPngLogoPath = `/overrides/${icons.stdcm.light}@2x.png`;
          const horizonLogoWithNamePath = `/overrides/${icons.digital_twin.dark}_Grey10.svg`;
          const horizonLogoPath = `/overrides/${icons.digital_twin.dark}_Logo_Grey40.svg`;

          setCustomizedDeploymentSetting({
            isLoading: false,
            deploymentSettings: {
              digitalTwinName: names.digital_twin,
              digitalTwinLogo: horizonLogoPath,
              digitalTwinLogoWithName: horizonLogoWithNamePath,
              stdcmName: names.stdcm,
              stdcmLogo: lmrLogoPath,
              stdcmSimulationSheetLogo: lmrPngLogoPath,
              isCustomizedDeployment: true,
              stdcmFeedbackMail: stdcm_feedback_mail,
            },
          });
        }
      } catch (error) {
        console.error('Error fetching overrides.json', error);
      }
    };

    fetchInternalProd();
  }, []);

  return (
    <deploymentSettingsContext.Provider value={customizedDeploymentSetting}>
      {children}
    </deploymentSettingsContext.Provider>
  );
};

const useDeploymentSettings = () => {
  const context = useContext(deploymentSettingsContext);
  if (!context) {
    throw new Error(
      'useManageTrainScheduleContext must be used within a ManageTrainScheduleContext'
    );
  }
  return context.deploymentSettings;
};

export default useDeploymentSettings;
