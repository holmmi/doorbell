import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  en: {
    translation: {
      common: {
        loading: 'Loading',
      },
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
      listing: {
        createCta: 'List a home',
        back: '← Back to home',
        title: 'List your apartment',
        subtitle:
          'Add the basics. Renters swipe, and you get a ring when someone likes it.',
        neighborhood: 'Neighbourhood',
        neighborhoodPlaceholder: 'e.g. Kamppi',
        cityPlaceholder: 'e.g. Helsinki',
        city: 'City',
        availableFrom: 'Available from',
        rooms: 'Rooms',
        roomTypes: {
          STUDIO: 'Studio',
          ONE_ROOM_AND_KITCHEN: '1 room + kitchen',
          TWO_ROOMS_AND_KITCHEN: '2 rooms + kitchen',
          THREE_PLUS_ROOMS: '3+ rooms',
        },
        rent: 'Rent / month (€)',
        squareMeters: 'Size (m²)',
        extraCosts: 'Extra costs',
        extraCostsPlaceholder: 'e.g. €40 / month (water & internet)',
        photos: 'Photos',
        photosAdded_one: '{{count}} photo added ✓',
        photosAdded_other: '{{count}} photos added ✓',
        photoHint: 'PNG or JPG. The first photo is the cover.',
        addPhotos: 'Add photos',
        addMore: '+ Add more',
        removePhoto: 'Remove {{name}}',
        publish: 'Publish listing',
        published: 'Listing published ✓',
        preview: 'Preview: what renters see',
        newToday: 'New today',
        perMonth: '{{price}}/mo',
        availableNow: 'Available now',
        availableOn: 'Available {{date}}',
        noExtras: 'No extra costs',
        area: '{{size}} m²',
        liveTitle: 'Ding dong! Your listing is live.',
        liveBody:
          'Renters in {{city}} can now swipe on it. We’ll ring you as soon as someone likes your home.',
        backHome: 'Back to home',
        progress: {
          creating: 'Creating draft…',
          uploading: 'Uploading photos…',
          saving: 'Saving listing…',
          publishing: 'Publishing listing…',
        },
        validation: {
          required: 'This field is required.',
          number: 'Enter a valid number.',
          range:
            'Enter a value greater than zero and within the allowed range.',
          date: 'Enter a valid date.',
          photosRequired: 'Add at least one photo before publishing.',
          photoType: 'Only PNG, JPG, and JPEG photos are supported.',
        },
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
          notFound: 'This listing could not be found.',
          image: {
            invalidKey: 'A photo upload expired. Please try again.',
            invalidObject: 'A photo is empty or has an unsupported format.',
            notUploaded: 'A photo upload could not be found. Please retry.',
            alreadyFinalized: 'A photo has already been added to this listing.',
            conflict: 'These photos conflict. Please retry the upload.',
            uploadFailed: 'A photo could not be uploaded. Please retry.',
            idOrKeyRequired:
              'We could not save one of your photos. Please remove it and add it again.',
            duplicate: {
              id: 'The same image is listed more than once.',
              objectKey: 'The same upload is used more than once.',
              displayOrder: 'Each image must have a different order.',
            },
          },
          images: {
            incomplete: 'Add at least one photo before publishing.',
          },
        },
        unknown: 'Something went wrong. Please try again.',
        network: 'Cannot reach the server. Please try again.',
        authentication: {
          unauthorized: 'Please sign in again.',
        },
        authorization: {
          forbidden: 'You do not have access to this page.',
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
