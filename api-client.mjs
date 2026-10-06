export async function requestJson(path, method = 'GET', body, fetcher = fetch) {
  let response;
  try { response = await fetcher(path, {method, credentials:'same-origin', cache:'no-store', headers:{Accept:'application/json', ...(body === undefined ? {} : {'Content-Type':'application/json'})}, body:body === undefined ? undefined : JSON.stringify(body), signal:AbortSignal.timeout(15000)}); }
  catch(error) { throw Object.assign(new Error(error.name === 'TimeoutError' ? 'The inventory request timed out. Try again.' : 'The browser could not complete the inventory request. Open this link directly in Safari or Chrome and try again.'), {code:'NETWORK'}); }
  const isJson=response.headers.get('content-type')?.includes('application/json');
  if (!isJson && (response.redirected || [401,403].includes(response.status))) throw Object.assign(new Error('The remote link returned a sign-in page instead of saving. Your form is still here. Open the app in Safari and sign in there, then try again.'),{code:'SIGN_IN'});
  if (!response.headers.get('content-type')?.includes('application/json')) throw Object.assign(new Error(`The remote service returned an unexpected response (HTTP ${response.status}). Try again. Your saved device draft is preserved.`),{code:'NON_JSON'});
  let data; try { data=await response.json(); } catch { throw Object.assign(new Error('The inventory response was incomplete. Try again.'),{code:'BAD_JSON'}); }
  if (!response.ok) throw Object.assign(new Error(data.message || `Request failed (HTTP ${response.status}).`),{errors:data.errors || {},status:response.status,code:'SERVER'});
  return data;
}
