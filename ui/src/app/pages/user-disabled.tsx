import * as React from 'react';

import {StyledExternalLink} from 'app/components/buttons';
import {BoldHeader} from 'app/components/headers';
import {PublicLayout} from 'app/components/public-layout';
import {WithSpinnerOverlayProps} from 'app/components/with-spinner-overlay';
import colors from 'app/styles/colors';
import {useEffect} from 'react';

const supportUrl = 'support@researchallofus.org';

export const UserDisabled = (spinnerProps: WithSpinnerOverlayProps) => {
  useEffect(() => spinnerProps.hideSpinner(), []);

  return <PublicLayout>
    <BoldHeader>Your account has been disabled</BoldHeader>
    <section style={{color: colors.primary, fontSize: '18px', marginTop: '.5rem'}}>
      Contact <StyledExternalLink href={'mailto:' + supportUrl}>{supportUrl}</StyledExternalLink> for
      more information.
    </section>
  </PublicLayout>;
};
