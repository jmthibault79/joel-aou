import * as React from 'react';

export const CustomBulletList = ({children}) => {
  return <ul style={{position: 'relative', listStyle: 'none', marginLeft: 0}}>{children}</ul>;
};

export const CustomBulletListItem = ({bullet, children}) => {
  return <React.Fragment>
    <div style={{position: 'absolute', left: '-.2em'}}> {bullet} </div> <li style={{marginLeft: '1.2em'}}> {children} </li>
  </React.Fragment>;
};
