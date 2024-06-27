!(async () => {
  if (typeof $response != 'undefined') {
    return setGrallery()
  }
})()

function setGrallery() {
  let body = $response.body
  body = JSON.parse(body)
  body.data.images = [
    {
      url: 'https://home.i95.me/d/Router/Scripts/A4L/IMG_9DA3ECC6D2B5-9.jpeg',
      config: 'onechnn8c'
    },
    {
      url: 'https://home.i95.me/d/Router/Scripts/A4L/IMG_9DA3ECC6D2B5-8.jpeg',
      config: 'onechnn8c'
    },
    {
      url: 'https://home.i95.me/d/Router/Scripts/A4L/IMG_9DA3ECC6D2B5-4.jpeg',
      config: 'onechnn8c'
    },
    {
      url: 'https://home.i95.me/d/Router/Scripts/A4L/IMG_9DA3ECC6D2B5-2.jpeg',
      config: 'onechnn8c'
    },
    {
      url: 'https://home.i95.me/d/Router/Scripts/A4L/IMG_9DA3ECC6D2B5-3.jpeg',
      config: 'onechnn8c'
    },
    {
      url: 'https://home.i95.me/d/Router/Scripts/A4L/IMG_9DA3ECC6D2B5-1.jpeg',
      config: 'onechnn8c'
    },
    {
      url: 'https://home.i95.me/d/Router/Scripts/A4L/IMG_9DA3ECC6D2B5-5.jpeg',
      config: 'onechnn8c'
    },
    {
      url: 'https://home.i95.me/d/Router/Scripts/A4L/IMG_9DA3ECC6D2B5-6.jpeg',
      config: 'onechnn8c'
    },
    {
      url: 'https://home.i95.me/d/Router/Scripts/A4L/IMG_9DA3ECC6D2B5-7.jpeg',
      config: 'onechnn8c'
    }
  ]
  body = JSON.stringify(body)

  $done({ body })
}
