import * as React from 'react';
import * as ReactModal from 'react-modal';

import {withStyle} from 'app/utils/index';

const styles = {
  modal: {
    borderRadius: 8, position: 'relative',
    padding: '1rem', margin: 'auto', outline: 'none',
    backgroundColor: 'white', boxShadow: '0 1px 2px 2px rgba(0,0,0,.2)'
  },

  overlay: {
    backgroundColor: 'rgba(49, 49, 49, 0.85)', padding: '1rem', display: 'flex',
    position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, overflowY: 'auto'
  },

  modalTitle: {
    fontSize: '20px',
    color: '#302973',
    fontWeight: 600,
    marginBottom: '1rem'
  },

  modalBody: {
    fontSize: '14px',
    lineHeight: '.8rem',
    marginTop: '3%',
    fontWeight: 400

  },

  modalFooter: {
    display: 'flex' as 'flex',
    justifyContent: 'flex-end' as 'flex-end',
    marginTop: '1rem'
  },

  modalInput: {
    fontWeight: 400,
    width: '100%',
    borderRadius: '5px',
    height: '1.5rem',
    border: '1px solid #9a9a9a',
    padding: '.25rem'
  }
};

export const Modal = ({width = 450, ...props}) => {
  return <ReactModal
    parentSelector={() => document.getElementById('popup-root')}
    isOpen
    style={{overlay: styles.overlay, content: {...styles.modal, width}}}
    ariaHideApp={false}
    {...props}
  />;
};

export const ModalTitle = withStyle(styles.modalTitle)('div');
export const ModalBody = withStyle(styles.modalBody)('div');
export const ModalFooter = withStyle(styles.modalFooter)('div');
export const ModalInput = withStyle(styles.modalInput)('input');
