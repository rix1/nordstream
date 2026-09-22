function handleEl(el) {
  const ts = el.previousElementSibling;
  const body = el.nextElementSibling;
  return {
    ts: ts ? Number(ts.getAttribute('data-timestamp')) : '',
    tsReadable: ts.innerText,
    headline: el.innerText,
    body: body ? body.innerText : '',
    url: ts.querySelector('a').href
  }
}

const titles = document.querySelectorAll('.bulletin-title')

const arr = [];
titles.forEach(el => arr.push(handleEl(el)))


const body = document.body

function replaceBody() {
  body.innerHTML = ''
  arr.sort((a, b) => a.ts - b.ts).forEach((el) => {
    const div = document.createElement('div')
    // const ts = document.createElement('p')
    // const headline = document.createElement('h2')
    // const body = document.createElement('p')
  
    // ts.innerHTML = el.ts
    // headline.innerHTML = el.headline
    // body.innerHTML = el.body
  
    // div.appendChild(ts)
    // div.appendChild(headline)
    // div.appendChild(body)
    div.innerHTML = `
      <div class="post">
      <p class="date">${el.tsReadable}</p>
      <h2 class="headline">${el.headline}</h2>
      <p class="body">${el.body} <a href=${el.url}>[link]</a></p>
      </div>
      `
    try {
      body.appendChild(div)
    } catch(err) {
      console.error(err)
    }
  })
}

replaceBody()