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
        filters: {
          city: 'City',
          neighborhood: 'Neighbourhood',
          maxPrice: 'Max price',
          size: 'Size',
          anyCity: 'Any city',
          allAreas: 'All areas',
          noLimit: 'No limit',
          anySize: 'Any size',
          price: '€{{price}}',
          minSize: '{{size}}+ m²',
          matchCount_one: '{{count}} home matches your filters',
          matchCount_other: '{{count}} homes match your filters',
        },
        rooms: {
          STUDIO: 'Studio',
          ONE_ROOM_AND_KITCHEN: '1 room + kitchen',
          TWO_ROOMS_AND_KITCHEN: '2 rooms + kitchen',
          THREE_PLUS_ROOMS: '3+ rooms',
        },
        card: {
          price: '€{{price}}/mo',
          availableNow: 'Available now',
          availableFrom: 'Available {{date}}',
          noExtraCosts: 'No extra costs',
          location: '{{neighborhood}}, {{city}}',
          specs: '{{rooms}} · {{size}} m²',
          viewDetails: 'View details →',
          newToday: 'New today',
          photoAlt: 'Photo {{number}} of {{count}}',
          photoCounter: '{{number}} / {{count}}',
          previousPhoto: 'Previous photo',
          nextPhoto: 'Next photo',
          showPhoto: 'Show photo {{number}}',
        },
        deck: {
          like: 'Like',
          dislike: 'Dislike',
          likeStamp: 'YUP!',
          dislikeStamp: 'NOPE',
          hint: 'Liking sends your profile to the landlord. No commitment.',
          landlordHint: 'Switch to a tenant account to like homes.',
          likeNotice: 'Ding dong! The landlord can now review your profile.',
          emptyTitle: 'You’ve seen every home here',
          emptyBody: 'Try a different location or a higher max price.',
          clearFilters: 'Clear filters',
          signUpTitle: 'Sign up to see every home',
          signUpDialogTitle: 'Create an account to like homes',
        },
        how: {
          title: 'How Doorbell works',
          subtitle:
            'Finding an apartment in Finland has never been this stress-free.',
          preferences: {
            title: 'Set your preferences',
            body: 'Select your budget, size, and neighborhoods in Helsinki, Tampere, or Turku.',
          },
          swipe: {
            title: 'Swipe homes',
            body: 'Right swipe to show interest. Left swipe to skip to the next place.',
          },
          match: {
            title: 'Match & get in touch',
            body: 'If the landlord likes your profile, you instantly get matched. Chat directly!',
          },
        },
        reviews: {
          title: 'What our customers say',
          emilia: {
            quote:
              'I found my lovely Kallio studio in just three days! It’s so much easier than refreshing traditional rental portals.',
            name: 'Emilia R.',
            city: 'Helsinki',
          },
          mikko: {
            quote:
              'Matching with the landlord directly means no endless application forms. Highly recommend Doorbell to students.',
            name: 'Mikko T.',
            city: 'Tampere',
          },
          saara: {
            quote:
              'Simple, fun, and extremely fast. We swiped, matched, toured, and signed the contract within a week.',
            name: 'Saara L.',
            city: 'Turku',
          },
        },
        landlords: {
          overline: 'FOR LANDLORDS',
          title: 'List your home in 2 minutes.',
          body: 'Add photos, rent and a few details. Only tenants who like your place reach you, and you choose who to match with.',
          bullets: {
            free: 'Free to list, live in under 10 minutes',
            interested: 'Only hear from tenants who already like your home',
            choose: 'You choose who to match with, no endless viewings',
          },
          cta: 'List your apartment →',
        },
        faq: {
          title: 'Questions? We’ve got answers.',
          free: {
            question: 'Is Doorbell free for tenants?',
            answer:
              'Yes. Browsing, swiping, liking and matching are completely free for tenants. No hidden fees, ever.',
          },
          replySpeed: {
            question: 'How fast do landlords reply?',
            answer:
              'Most landlords review new likes within 24 hours. You get a ring as soon as someone likes you back.',
          },
          afterMatch: {
            question: 'What happens after a match?',
            answer:
              'You both see each other’s contact details right away, so you can chat and book a viewing directly.',
          },
          verified: {
            question: 'Are landlords verified?',
            answer:
              'Every landlord confirms their identity with Finnish online banking before listing, so you know who you’re dealing with.',
          },
          landlordCost: {
            question: 'What does it cost for landlords?',
            answer:
              'Listing is free. Landlords pay a small one-time fee only when they sign a lease with a tenant they matched with.',
          },
        },
      },
      matches: {
        title: 'Your matches',
        subtitle:
          'These landlords liked you back. Reach out and book a viewing.',
        count_one: '{{count}} match',
        count_other: '{{count}} matches',
        matched: 'Matched',
        unpublished: 'Listing no longer published',
        contact: 'Contact landlord',
        hideContact: 'Hide contact',
        landlord: 'Landlord',
        email: 'Email',
        phone: 'Phone',
        detailsTitle: 'Listing details',
        closeDetails: 'Close details',
        loading: 'Loading your matches…',
        refreshing: 'Refreshing…',
        refresh: 'Refresh',
        retry: 'Retry',
        loadError: 'We could not load your matches. Please try again.',
        refreshError:
          'We could not refresh your matches. Your previous results are still shown. Please try again.',
        sessionError: 'We could not verify your account. Please try again.',
        tenantOnly: 'Matches are available to tenant accounts only.',
        home: 'Home',
        browse: 'Browse homes',
        empty: 'No matches yet. Browse homes to find your next home.',
      },
      listing: {
        viewDetails: 'View details',
        viewDetailsFor: 'View details for {{location}}',
        photoCount_one: '{{count}} photo',
        photoCount_other: '{{count}} photos',
        photoPosition: '{{current}} / {{total}}',
        previousPhoto: 'Previous photo',
        nextPhoto: 'Next photo',
        photoAlt: 'Photo {{index}} of the home in {{location}}',
        gallery: 'Listing photos',
        imageUnavailable: 'Photo unavailable',
        imageUnavailableAlt: '{{description}} — photo unavailable',
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
      footer: {
        navigation: 'Footer',
        about: 'About',
        contact: 'Contact',
        privacy: 'Privacy Policy',
        copyright:
          '© {{year}} Doorbell Oy. All rights reserved. Built for Finnish home seekers.',
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
          unavailable: 'This listing is no longer available.',
          preference: {
            conflict:
              'You have already liked or disliked this listing. Your choice cannot be changed.',
          },
          decision: {
            conflict:
              'You have already accepted or declined this applicant. Your decision cannot be changed.',
          },
          applicant: {
            notFound: 'This applicant could not be found for the listing.',
            notInterested: 'This tenant is not interested in the listing.',
          },
          images: {
            incomplete:
              'Add at least one photo before publishing your listing.',
          },
          image: {
            invalidKey:
              'This photo upload has expired or is invalid. Please upload it again.',
            invalidObject:
              'This photo is empty or does not match its file type. Please choose another image.',
            notUploaded:
              'This photo has not finished uploading. Please try again.',
            alreadyFinalized:
              'This photo has already been added to the listing.',
            conflict:
              'Some photos conflict with the saved listing. Refresh the listing and try again.',
            notFound: 'This photo could not be found in the listing.',
            uploadFailed: 'A photo could not be uploaded. Please retry.',
            idOrKeyRequired:
              'We could not save one of your photos. Please remove it and add it again.',
            duplicate: {
              id: 'The same image is listed more than once.',
              objectKey: 'The same upload is used more than once.',
              displayOrder: 'Each image must have a different order.',
            },
          },
        },
        unknown: 'Something went wrong. Please try again.',
        network: 'Cannot reach the server. Please try again.',
        authentication: {
          unauthorized: 'Please sign in again.',
        },
        authorization: {
          forbidden: 'You do not have permission to perform this action.',
        },
        request: {
          invalid:
            'The request is invalid. Please refresh the page and try again.',
        },
        server: {
          unexpected: 'Something went wrong on the server. Please try again.',
        },
        login: {
          invalidCredentials: 'The email or password is incorrect.',
        },
        registration: {
          userAlreadyExists:
            'An error occurred registering the account. Please try again.',
        },
        validation: {
          server: 'Some details are invalid. Check the form and try again.',
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
