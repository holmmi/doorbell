import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  en: {
    translation: {
      appName: 'Doorbell',
      nav: {
        home: 'Home',
        matches: 'Matches',
        profile: 'Profile',
      },
      profile: {
        avatarAlt: 'Profile picture',
      },
      home: {
        title: 'Find your next home, one swipe at a time',
        subtitle: 'Like a home and the landlord gets a ring.',
      },
      matches: {
        count: '3',
      },
      auth: {
        signUp: 'Sign up',
        logIn: 'Log in',
        switchForm: 'Authentication form',
        loginTitle: 'Welcome back',
        loginDescription: 'Sign in to continue to Doorbell.',
        registrationTitle: 'Create your account',
        registrationDescription: 'Find a home or meet your next tenant.',
        chooseRole: 'I am…',
        tenant: 'Tenant',
        tenantBody: 'Swipe homes and match with landlords.',
        landlord: 'Landlord',
        landlordBody: 'List homes and choose your tenants.',
        firstName: 'First name',
        lastName: 'Last name',
        email: 'Email',
        password: 'Password',
        passwordHint: 'Use at least 8 characters.',
        loginAction: 'Sign in',
        registrationAction: 'Create account',
        submitting: 'Please wait…',
        demo: 'Explore without an account',
        validation: {
          required: 'This field is required.',
          email: 'Enter a valid email address.',
          passwordMin: 'Use at least 8 characters.',
          passwordMax: 'Password must be 72 bytes or fewer.',
        },
      },
      error: {
        listing: {
          image: {
            idOrKeyRequired: 'An image ID or object key is required.',
            duplicate: {
              id: 'The same image is listed more than once.',
              objectKey: 'The same upload is used more than once.',
              displayOrder: 'Each image must have a different position.',
            },
          },
        },
        unknown: 'Something went wrong. Please try again.',
        network: 'Cannot reach the server. Please try again.',
        authentication: {
          unauthorized: 'Please sign in again.',
        },
        login: {
          invalidCredentials: 'The email or password is incorrect.',
        },
        registration: {
          userAlreadyExists:
            'An error occurred registering the account. Please try again.',
        },
        validation: {
          server:
            'Some account details are invalid. Check the form and try again.',
        },
      },
      pageTitles: {
        matches: 'Matches',
        profile: 'Profile',
      },
    },
  },
}

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
