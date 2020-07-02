import {GoogleSignInButton} from 'app/components/google-sign-in';
import {BoldHeader} from 'app/components/headers';
import {PublicLayout} from 'app/components/public-layout';
import colors from 'app/styles/colors';
import {reactStyles} from 'app/utils';
import {buildPageTitleForEnvironment} from 'app/utils/title';
import * as React from 'react';

const styles = reactStyles({
  button: {
    fontSize: '16px',
    marginTop: '1rem'
  },
  textSection: {
    color: colors.primary,
    fontSize: '18px',
    marginTop: '.5rem'
  }
});

export class SessionExpired extends React.Component<{routeConfig: {signIn: Function}}> {
  componentDidMount() {
    document.title = buildPageTitleForEnvironment('You have been signed out');
  }

  render() {
    return <PublicLayout>
      <BoldHeader>You have been signed out</BoldHeader>
      <section style={styles.textSection}>
        You were automatically signed out of your session due to inactivity
      </section>
      <GoogleSignInButton signIn={() => this.props.routeConfig.signIn()}/>
    </PublicLayout>;
  }
}
