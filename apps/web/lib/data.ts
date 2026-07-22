import { posts } from "@/lib/posts"
import { users } from "@/lib/user"
import { locations } from "@/lib/location"
import { categories } from "@/lib/categories"

export function getCategoryById(cateId: string) {
  return categories.find(category => category.cateId === cateId)
}

export function getSubCategoryById(subId: string) {
  return categories.flatMap(category => category.subcategories).find(sub => sub.subId === subId)
}
export function getBrandById(brandId: string) {
  return categories.flatMap(category => category.subcategories).flatMap(subcategory => subcategory.brands).find(brand => brand?.brandId === brandId)
}
export function getModelById(modelId: string) {
  return categories
    .flatMap((category) => category.subcategories)
    .flatMap((subcategory) => subcategory.brands || [])
    .flatMap((brand) => brand.model || [])
    .find((model) => model.modelId === modelId)
}

export function getPostById(id: string) {
  return posts.find(post => post.postId === Number(id))
}

export function getUserById(userId: string) {
  return users.find(user => user.userId === userId)
}

export function getUserByUsername(username: string) {
  return users.find(user => user.username === username)
}
export function getUsernameByUserId(userId: string) {
  return users.find(user => user.userId === userId)
}

export function getPostsByUser(userId: string) {
  return posts.filter(post => post.userId === userId)
}
export function getPostsByLocation(proId: string, disId: string) {
  return posts.filter(post => post.proId === proId && post.disId === disId)
}
export function getProvinceById(proId: string) {
  return locations.find(p => p.proId === proId)
}

export function getDistrictById(proId: string, disId: string) {
  const province = locations.find(p => p.proId === proId)
  return province?.districts.find(d => d.disId === disId)
}