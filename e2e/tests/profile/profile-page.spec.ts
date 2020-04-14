import HomePage from 'app/home-page';
import ProfilePage from 'app/profile-page';
import {signIn} from 'tests/app';
import {NavLink} from 'app/page-identifiers';


describe('Profile', () => {

  beforeEach(async () => {
    await signIn(page);
  });


  test('Click First and Last name fields on Profile page', async () => {
    const homePage = new HomePage(page);
    await homePage.waitForLoad();
    await homePage.navTo(NavLink.PROFILE);
    const profilePage = new ProfilePage(page);
    const fname = await (await profilePage.getFirstName()).getValue();
    const lname = await (await profilePage.getLastName()).getValue();
      // check last and first name textbox is not empty
    expect(fname).toMatch(new RegExp(/^[a-zA-Z]+/));
    expect(lname).toMatch(new RegExp(/^[a-zA-Z]+/));
    expect(lname).not.toEqual(fname);
  });

});
