// Mock crawler: replace with real extraction when ready.
export async function crawlProducts(url) {
  return [{
    name: `Product from ${url}`,
    imageUrl: 'https://via.placeholder.com/300.png?text=Image',
    price: (Math.random()*50+5).toFixed(2),
    moq_value: Math.floor(Math.random()*100)+10,
    description: 'This is a mocked description for demonstration.',
    params: { color: 'Black', material: 'ABS', size: '10x10x5cm' },
    productUrl: url
  }]
}
