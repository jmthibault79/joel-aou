import * as React from 'react';
import { CSSProperties } from 'react';

import { environment } from 'environments/environment';
import colors from 'app/styles/colors';
import { reactStyles, withStyle } from 'app/utils/index';
import logo from 'assets/images/all-of-us-logo.svg';

export const styles = reactStyles({
  h1: {
    color: colors.primary,
    fontWeight: 500,
    fontSize: '1.6rem',
  },
  h2: {
    color: colors.primary,
    fontWeight: 800,
    fontSize: '1.25rem',
  },
  h3: {
    color: colors.primary,
    fontWeight: 800,
    fontSize: '1rem',
  },
  semiBold: {
    fontWeight: 600,
  },
  h4: {
    fontWeight: 300,
    color: colors.primary,
  },
  formLabel: {
    color: colors.primary,
    fontWeight: 600,
    marginTop: '0.5rem',
    marginBottom: '0.125rem',
  },
  listPageHeader: {
    color: colors.primary,
    fontSize: '20px',
    lineHeight: '24px',
    fontWeight: 600,
    marginTop: 0,
    paddingTop: '0.5rem',
  },
  pageHeader: {
    color: colors.primary,
    fontSize: '28px',
    fontWeight: 400,
  },
  headerImageSignedIn: {
    height: 57,
    width: 155,
    marginLeft: '1rem',
  },
  headerImagePublic: {
    height: '1.75rem',
    marginLeft: '1rem',
    marginTop: '1rem',
  },
  displayTagSignedIn: {
    marginLeft: '1rem',
    height: 12,
    width: 155,
    borderRadius: 2,
    backgroundColor: colors.primary,
    color: colors.white,
    fontFamily: 'Montserrat',
    fontSize: '8px',
    lineHeight: '12px',
    textAlign: 'center',
  },
  displayTagPublic: {
    marginLeft: '1rem',
    height: 12,
    width: 135,
    borderRadius: 2,
    backgroundColor: colors.primary,
    color: colors.white,
    fontFamily: 'Montserrat',
    fontSize: '8px',
    lineHeight: '12px',
    textAlign: 'center',
  },
});

export const BolderHeader = withStyle(styles.h1)('h1');
export const BoldHeader = withStyle(styles.h2)('h2');
export const Header = withStyle(styles.h3)('h3');
export const SemiBoldHeader = withStyle({ ...styles.h3, ...styles.semiBold })(
  'h3'
);
export const SmallHeader = withStyle(styles.h4)('h4');
export const ListPageHeader = withStyle(styles.listPageHeader)('h3');
export const PageHeader = withStyle(styles.pageHeader)('h2');

const AouHeaderWithDisplayTag = (props: {
  headerStyle: CSSProperties;
  tagStyle: CSSProperties;
}) => (
  <div>
    <a href='/'>
      <img style={props.headerStyle} src={logo} alt='all of us logo' />
    </a>
    {environment.shouldShowDisplayTag && (
      <div style={props.tagStyle}>{environment.displayTag}</div>
    )}
  </div>
);

export const SignedInAouHeaderWithDisplayTag = () => (
  <AouHeaderWithDisplayTag
    headerStyle={styles.headerImageSignedIn}
    tagStyle={styles.displayTagSignedIn}
  />
);

export const PublicAouHeaderWithDisplayTag = () => (
  <AouHeaderWithDisplayTag
    headerStyle={styles.headerImagePublic}
    tagStyle={styles.displayTagPublic}
  />
);
